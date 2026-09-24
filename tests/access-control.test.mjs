import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALLOWED_EMAILS, canAccessApp, canAccessStats } from '../services/accessControl.ts';

test('każde konto dopuszczone do CRM jest na identycznej liście Firestore', () => {
 const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
 const team = rules.match(/function zespolMyWay\(\)\s*\{\s*return\s*\[([\s\S]*?)\]/);
 assert.ok(team);
 const emails = [...team[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
 assert.deepEqual(emails.sort(), [...ALLOWED_EMAILS].sort());
});

test('Beata ma dostęp do aplikacji, ale nie do statystyk', () => {
 assert.equal(canAccessApp('beatakorzonek1@gmail.com'), true);
 assert.equal(canAccessStats('beatakorzonek1@gmail.com'), false);
 assert.equal(canAccessStats(' BEATAKORZONEK1@GMAIL.COM '), false);
 assert.equal(canAccessStats('mywaymarcin@gmail.com'), true);
 assert.equal(canAccessApp('obcy@example.invalid'), false);
 assert.equal(canAccessApp(null), false);
});

test('nowy zespół ma CRM bez statystyk, Natalia pełny dostęp', () => {
 for (const email of ['waldemarsikorski77@gmail.com','stanislaw.babinski@gmail.com','patrycjabjerk88@gmail.com','kuskowskam@gmail.com']) {
  assert.equal(canAccessApp(email), true, email);
  assert.equal(canAccessStats(email), false, email);
 }
 assert.equal(canAccessApp('Npucz708@gmail.com'), true);
 assert.equal(canAccessStats('Npucz708@gmail.com'), true);
});

test('Darek has statistics access including normalized email', () => {
 assert.equal(canAccessStats('dariusz.szuca@gmail.com'), true);
 assert.equal(canAccessStats(' DARIUSZ.SZUCA@GMAIL.COM '), true);
});
