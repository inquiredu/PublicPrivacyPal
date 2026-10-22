import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicNoticeDetail } from '../../src/PublicNoticeDetail.tsx';
import type { LibraryProfile } from '../../shared/settings.ts';
const profile: LibraryProfile = { id: 'synthetic', name: 'Fictional tool', category: 'Learning', summary: 'Full public summary', grades: '6–8', dataUse: 'student_data', dataCategories: 'Names; classroom activity', conditions: 'Teacher supervision', permissionWhen: 'Consent for optional accounts', alternative: 'Paper activity', support: 'PRIVATE SUPPORT', educationNotes: 'PRIVATE NOTES', score: 99 };
const render = (p: LibraryProfile) => renderToStaticMarkup(createElement(PublicNoticeDetail, { profile: p, contactEmail: 'privacy@school.example', onClose() {} }));
test('expanded public notice renders family guidance without staff-only fields or score', () => {
  const html = render(profile);
  for (const text of ['Full public summary', '6–8', 'Names; classroom activity', 'Teacher supervision', 'Consent for optional accounts', 'Paper activity', 'mailto:privacy@school.example', 'aria-labelledby', 'Close notice']) assert.ok(html.includes(text), text);
  for (const text of ['PRIVATE SUPPORT', 'PRIVATE NOTES', '99', 'signed agreement']) assert.ok(!html.includes(text), text);
});
test('missing public data remains unknown, never an invented no-data or district-wide-use claim', () => {
  const html = render({ id: 'example', name: 'Example', summary: 'Synthetic', category: 'Example' });
  assert.ok(html.includes('has not been confirmed')); assert.ok(html.includes('Grade scope has not been provided'));
  assert.ok(!html.includes('No student data in the recorded use conditions'));
});

test('policy link uses only the published field and rejects unsafe or credential-bearing URLs', () => {
  const html = render({ ...profile, policyUrl: 'https://vendor.example/privacy?version=1' });
  assert.ok(html.includes('href="https://vendor.example/privacy?version=1"')); assert.ok(html.includes('rel="noopener noreferrer"')); assert.ok(html.includes('opens in a new tab'));
  for (const policyUrl of [undefined, '', 'javascript:alert(1)', 'data:text/html,bad', '//vendor.example/privacy', 'https://user:secret@vendor.example/privacy', 'https://vendor.example/\nprivacy']) {
    assert.ok(!render({ ...profile, policyUrl }).includes('Read the full policy'), String(policyUrl));
  }
});
