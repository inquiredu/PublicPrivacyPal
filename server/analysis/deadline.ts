/** A bounded wait does not cancel an SDK RPC. Call check() at transaction callback boundaries
 * so a callback resumed after expiry cannot submit its buffered writes. Already-submitted
 * commits can have an unknown acknowledgement; durable leases/transaction conflicts fence recovery. */
export class OperationDeadline {
  private readonly controller = new AbortController();
  readonly signal: AbortSignal;
  private readonly expiresAt: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  constructor(timeoutMs: number, external?: AbortSignal) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Use a positive operation deadline.');
    this.expiresAt = performance.now() + timeoutMs;
    this.signal = external ? AbortSignal.any([this.controller.signal, external]) : this.controller.signal;
    this.timer = setTimeout(() => this.abort(), timeoutMs);
  }
  abort() { this.controller.abort(new Error('Operation deadline or cancellation.')); }
  check() {
    if (performance.now() >= this.expiresAt) this.abort();
    this.signal.throwIfAborted();
  }
  async wait<T>(action: () => Promise<T>): Promise<T> {
    this.check();
    let rejectAbort!: () => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(this.signal.reason); });
    this.signal.addEventListener('abort', rejectAbort, { once: true });
    try {
      const value = await Promise.race([Promise.resolve().then(() => { this.check(); return action(); }), aborted]);
      this.check();
      return value;
    } finally { this.signal.removeEventListener('abort', rejectAbort); }
  }
  dispose() { this.abort(); clearTimeout(this.timer); }
}
