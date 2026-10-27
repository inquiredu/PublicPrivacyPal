import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueSuggestions, staffSuggestionSchema, CATALOGUE_SUGGESTION_LIMIT, CATALOGUE_SUGGESTION_PAGE } from '../../shared/catalogue-suggestions.ts';
const entry = (id: string, name: string) => ({ id, name, summary: 'Synthetic staff guidance', category: 'Practice' });
test('catalogue hints normalize punctuation, case and Unicode; exact names precede longer matches', () => {
  const rows = [entry('long', 'Garden Reading Lab'), entry('exact', 'Reading'), entry('unicode', 'Ｒｅａｄｉｎｇ')];
  assert.deepEqual(catalogueSuggestions(rows, 'READING!').map(p => p.id).sort(), ['exact', 'long', 'unicode']);
  assert.equal(catalogueSuggestions(rows, 'reading').at(-1)?.id, 'long');
  assert.equal(catalogueSuggestions([entry('one', 'Google Docs')], 'GOOGLE-DOCS!').length, 1);
  assert.equal(catalogueSuggestions([entry('one', 'Leçon')], 'LEÇON').length, 1);
});
test('duplicate display names remain distinct and empty or unmatched names never return everything', () => {
  const rows = [entry('b', 'Cedar'), entry('a', 'Cedar')];
  assert.deepEqual(catalogueSuggestions(rows, 'cedar').map(p => p.id), ['a', 'b']);
  for (const name of ['', '  ', '.*', 'No matching service']) assert.deepEqual(catalogueSuggestions(rows, name), []);
});
test('complete bounded catalogue matches are filtered before UI paging; overflow refuses partial suggestions', () => {
  const rows = Array.from({ length: CATALOGUE_SUGGESTION_LIMIT }, (_, i) => entry(String(i), `Tool ${i}`));
  const matches = catalogueSuggestions(rows, 'Tool'); assert.equal(matches.length, CATALOGUE_SUGGESTION_LIMIT);
  assert.equal(matches.slice(CATALOGUE_SUGGESTION_PAGE, 2 * CATALOGUE_SUGGESTION_PAGE).length, CATALOGUE_SUGGESTION_PAGE);
  assert.throws(() => catalogueSuggestions([...rows, entry('overflow', 'Tool')], 'No match'), /limit/);
});
test('suggestion display strips unknown fields and rejects malformed publication fields', () => {
  const parsed = staffSuggestionSchema.parse({ ...entry('one', 'Cedar'), privateNote: 'Never render', score: 100, conditions: 'Teacher supervised' });
  assert.equal('privateNote' in parsed, false); assert.equal('score' in parsed, false);
  assert.equal(parsed.conditions, 'Teacher supervised');
  assert.equal(staffSuggestionSchema.safeParse({ ...entry('one', 'Cedar'), summary: { private: true } }).success, false);
});
