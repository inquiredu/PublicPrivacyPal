/** Only explicitly published HTTP(S) links are eligible for a public notice. */
export function publicPolicyUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 500 || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value) || !/^https?:\/\//i.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : undefined;
  } catch { return undefined; }
}
