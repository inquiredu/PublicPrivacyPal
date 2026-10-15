import type { User } from 'firebase/auth';
export async function api<T>(path: string, user?: User | null, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Local service unavailable.');
  return data as T;
}
