import { z } from 'zod';

export const MAX_POLICY_LENGTH = 32000;

/** Reject malformed UTF-16 instead of hashing/replacing it as the UTF-8 replacement character. */
export function isWellFormedText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

export const canonicalTextSchema = (max: number) => z.string().max(max)
  .refine(s => s.trim().length > 0, 'Paste policy text.')
  .refine(isWellFormedText, 'Use valid Unicode text without unpaired surrogates.')
  .refine(s => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s), 'Use canonical plain text with LF line endings and no control characters.');

export const canonicalPolicyTextSchema = canonicalTextSchema(MAX_POLICY_LENGTH);

// Keep the existing raw-input cap as well as the canonical cap. Normalize only at ingestion;
// saved sources, hashes and citation offsets must all refer to the same exact canonical text.
export const policyTextSchema = z.string().max(MAX_POLICY_LENGTH)
  .transform(s => s.replace(/\r\n?/g, '\n')).pipe(canonicalPolicyTextSchema);
