import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessApp,
  canAccessStats,
  STATS_ACCESS_EMAILS,
} from '../services/accessControl.ts';

test('statystyki sa dostepne tylko dla Marcina, Natalii i Krystiana', () => {
  assert.deepEqual(STATS_ACCESS_EMAILS, [
    'mywaymarcin@gmail.com',
    'npucz708@gmail.com',
    'krystiannagaba@gmail.com',
  ]);

  assert.equal(canAccessStats('mywaymarcin@gmail.com'), true);
  assert.equal(canAccessStats('NPUCZ708@gmail.com'), true);
  assert.equal(canAccessStats('krystiannagaba@gmail.com'), true);
  assert.equal(canAccessStats('gabinet.osrodekmyway@gmail.com'), false);
  assert.equal(canAccessStats('dariusz.szuca@gmail.com'), false);
  assert.equal(canAccessStats(null), false);
});

test('dostep do aplikacji zostaje dla obecnej bialej listy', () => {
  assert.equal(canAccessApp('dariusz.szuca@gmail.com'), true);
  assert.equal(canAccessApp('gabinet.osrodekmyway@gmail.com'), true);
  assert.equal(canAccessApp('nieznany@example.com'), false);
});
