import test from 'node:test';
import assert from 'node:assert/strict';
import { averagePerPatient, DEFAULT_EXCLUDED_PACKAGES } from '../services/statsCalc.ts';

const patient = (pkg, totalAmount, additionalServices = []) => ({ package: pkg, totalAmount, additionalServices });

test('średnia liczy tylko pacjentów z wybranych pakietów', () => {
  const patients = [patient('1', 10000), patient('1', 12000), patient('vip', 0), patient('interwencyjna', 3000)];
  const result = averagePerPatient(patients, ['1', 'interwencyjna']);
  assert.equal(result.count, 3);
  assert.equal(result.revenue, 25000);
  assert.equal(result.average, 25000 / 3);
});

test('przychód pacjenta obejmuje usługi dodatkowe, tak jak kafelek Przychód', () => {
  const patients = [patient('3', 11000, [{ type: 'recepta', amount: 150 }, { type: 'psychiatra', amount: 300 }])];
  const result = averagePerPatient(patients, ['3']);
  assert.equal(result.revenue, 11450);
  assert.equal(result.average, 11450);
});

test('brak pacjentów w wybranych pakietach daje średnią null, nie NaN', () => {
  const result = averagePerPatient([patient('vip', 0)], ['1']);
  assert.equal(result.count, 0);
  assert.equal(result.average, null);
});

test('usługa bez kwoty nie psuje sumy', () => {
  const result = averagePerPatient([patient('1', 1000, [{ type: 'inne' }])], ['1']);
  assert.equal(result.revenue, 1000);
});

test('domyślnie wykluczona jest tylko Grupa VIP', () => {
  assert.deepEqual(DEFAULT_EXCLUDED_PACKAGES, ['vip']);
});
