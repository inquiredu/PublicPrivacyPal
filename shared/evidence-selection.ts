import type { Citation } from './review.ts';

/** A typed quote must identify one passage. Repeated text needs an explicit source selection. */
export function uniqueCitation(source: string, quote: string): Citation {
  if (!quote.trim() || quote.length > 2000) throw new Error('Use a quotation between 1 and 2,000 characters.');
  const start = source.indexOf(quote);
  if (start < 0) throw new Error('That quotation does not exactly match the saved policy. Select the passage directly, or copy it without changing punctuation or whitespace.');
  if (source.indexOf(quote, start + 1) >= 0) throw new Error('This passage appears more than once. Select its exact location in the policy, then add the selected passage.');
  return { quote, start, end: start + quote.length };
}
