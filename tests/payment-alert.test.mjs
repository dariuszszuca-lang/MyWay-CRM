import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const functionsIndex = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');

test('payment reminder window is 14 days in the CRM UI', () => {
  assert.match(app, /paymentAlertDaysBefore\s*=\s*14/);
  assert.match(app, /kończy się w ciągu \{paymentAlertDaysBefore\} dni/);
});

test('payment reminder window is 14 days in the daily email alert', () => {
  assert.match(functionsIndex, /DAYS_BEFORE\s*=\s*14/);
  assert.match(functionsIndex, /14 dni przed końcem terapii/);
});
