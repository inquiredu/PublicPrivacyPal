import type { User } from 'firebase/auth';
export class ApiError extends Error {
  constructor(message: string, public status: number | null, public uncertain = false) { super(message); }
}
export type RequestOptions = { commandId?: string; timeoutMs?: number; fetcher?: typeof fetch };
export async function requestJson<T>(path: string, token: (() => Promise<string>) | undefined, body: unknown, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController(); let dispatched = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mutation = body !== undefined;
  try {
    return await Promise.race([
      (async () => {
        const bearer = token ? await token() : undefined;
        if (controller.signal.aborted) throw new ApiError('The request timed out before it was sent. Try again.', null);
        dispatched = true;
        const response = await (options.fetcher || fetch)(path, {
          method: mutation ? 'POST' : 'GET', signal: controller.signal,
          headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(mutation ? { 'Content-Type': 'application/json' } : {}), ...(options.commandId ? { 'Idempotency-Key': options.commandId } : {}) },
          ...(mutation ? { body: JSON.stringify(body) } : {}),
        });
        let data;
        try { data = await response.json(); }
        catch { throw new ApiError('The service returned an unreadable response. Check the saved result before retrying.', response.status, mutation); }
        if (!response.ok) throw new ApiError(data.error || 'Local service unavailable.', response.status, mutation && response.status >= 500);
        return data as T;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new ApiError(dispatched && mutation ? 'The response timed out. The change may have been saved; check its result.' : 'The local service did not respond in time. Try again.', null, dispatched && mutation));
      }, options.timeoutMs ?? 12000); }),
    ]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(dispatched && mutation ? 'The connection was interrupted. The change may have been saved; check its result.' : 'The local service could not be reached. Try again.', null, dispatched && mutation);
  } finally { clearTimeout(timer); }
}
export function api<T>(path: string, user?: User | null, body?: unknown, options?: RequestOptions): Promise<T> {
  return requestJson(path, user ? () => user.getIdToken() : undefined, body, options);
}
