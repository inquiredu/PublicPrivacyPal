import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { LibraryView } from '../../src/LibraryView.tsx';
import { accentText, defaultEvaluation, defaultLibrary, evaluationAreas, evaluationSettingsSchema, librarySettingsSchema, publicLibrarySettings, settingsCommandSchema, visibleProfiles } from '../../shared/settings.ts';

test('the optional starter preserves all original measures; invalid and disabled configurations fail', () => {
  assert.equal(evaluationAreas.length, 11); assert.equal(evaluationAreas.reduce((n, a) => n + a.criteria.length, 0), 50);
  assert.equal(evaluationSettingsSchema.safeParse(defaultEvaluation()).success, false);
  const original = { ...defaultEvaluation(), state: 'Colorado' as const }; assert.equal(evaluationSettingsSchema.safeParse(original).success, true);
  for (const change of [{ state: 'Unknown' }, { laws: [] }, { laws: ['invented'] }, { evaluationStandards: ['iste', 'iste'] }, { evaluationWeights: {} }, { evaluationWeights: { ...original.evaluationWeights, security: Infinity } }, { evaluationWeights: { ...original.evaluationWeights, security: 9 } }, { evaluationWeights: { ...original.evaluationWeights, invented: 1 } }, { evaluationWeights: Object.fromEntries(evaluationAreas.map(a => [a.id, 0])) }, { customEvaluationContext: 'x'.repeat(6001) }, { districtMission: '\u0000hidden' }, { starterProfile: 'none' }]) assert.equal(evaluationSettingsSchema.safeParse({ ...original, ...change }).success, false, JSON.stringify(change));
  assert.equal(evaluationSettingsSchema.safeParse({ ...original, starterProfile: 'none', evaluationWeights: {} }).success, true);
  assert.deepEqual(evaluationSettingsSchema.parse(original), evaluationSettingsSchema.parse({ ...original, laws: [...original.laws].reverse(), evaluationStandards: [...original.evaluationStandards].reverse(), evaluationWeights: Object.fromEntries(Object.entries(original.evaluationWeights).reverse()) }));
});
test('library validation rejects active content, remote logos, unknown fields, unsafe contacts and duplicate sections', () => {
  const values = defaultLibrary('Fictional Example District');
  assert.equal(librarySettingsSchema.safeParse(values).success, true);
  for (const change of [{ title: ' ' }, { themeColor: 'url(https://bad.example)' }, { logo: 'https://tracking.example/logo.png' }, { logo: 'data:image/svg+xml;base64,PHN2Zy8+' }, { contactEmail: 'javascript:alert(1)' }, { contactEmail: 'person@real-domain.com' }, { footerSections: [values.footerSections[0], values.footerSections[0]] }, { defaultSortMode: 'score_desc' }, { notes: 'private' }]) assert.equal(librarySettingsSchema.safeParse({ ...values, ...change }).success, false);
  assert.deepEqual(publicLibrarySettings(Object.assign({}, values, { secret: 'never public', updatedBy: 'actor' })), values);
  for (const extra of [{ districtId: 'foreign' }, { updatedBy: 'forged' }, { complete: true }, { revision: -1 }]) assert.equal(settingsCommandSchema.safeParse({ section: 'library', revision: 0, values, ...extra }).success, false);
});
test('library filters and sort preserve unclassified tools and deterministic district order', () => {
  const profiles = [
    { id: 'b', name: 'Beta', summary: 'Story reading', category: 'Literacy', sortOrder: 0 },
    { id: 'a', name: 'Alpha', summary: 'Shapes', category: 'Math', tierLevel: 'Tier 2: Site/Department Approved' as const, sortOrder: 1 },
    { id: 'c', name: 'Alpha', summary: 'Numbers', category: 'Math', tierLevel: 'Tier 1: Core System Tool' as const },
  ];
  assert.deepEqual(visibleProfiles(profiles, '', 'all', 'library_order').map(p => p.id), ['b', 'a', 'c']);
  assert.deepEqual(visibleProfiles(profiles, '', 'all', 'name_asc').map(p => p.id), ['a', 'c', 'b']);
  assert.deepEqual(visibleProfiles(profiles, '', 'all', 'tier_asc').map(p => p.id), ['c', 'a', 'b']);
  assert.deepEqual(visibleProfiles(profiles, 'story', 'Pending', 'name_asc').map(p => p.id), ['b']);
  assert.equal(visibleProfiles(profiles, '', 'Tier 3B: No Account Required', 'name_asc').length, 0);
});
test('library content renders as text and an intentionally empty footer remains absent', () => {
  const settings = { ...defaultLibrary('Fictional'), title: '<script>alert(1)</script>', customDisclaimer: '<img src=x onerror=alert(1)>', footerSections: [] };
  const html = renderToStaticMarkup(createElement(LibraryView, { settings, profiles: [] }));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('library-footer'));
});
test('accent text preserves readable contrast at both extremes and at the luminance crossover', () => {
  assert.equal(accentText('#ffffff'), '#000000'); assert.equal(accentText('#000000'), '#ffffff');
  for (const color of ['#0284c7', '#777777', '#ffcc00', '#c000d2', '#123456']) {
    const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    const l = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    const ratio = accentText(color) === '#000000' ? (l + .05) / .05 : 1.05 / (l + .05);
    assert.ok(ratio >= 4.5, color);
  }
});
