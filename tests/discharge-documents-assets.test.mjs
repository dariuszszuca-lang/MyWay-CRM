import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredAssets } from '../services/dischargeDocuments.ts';

test('dyplom potrzebuje tła poziomego, logo i czterech fontów', () => {
  const a = requiredAssets('dyplom');
  assert.equal(a.background, '/dokumenty/tlo-dyplom.jpg');
  assert.equal(a.logo, '/dokumenty/logo-myway.png');
  assert.deepEqual(Object.keys(a.fonts).sort(), ['cormorantBold', 'cormorantRegular', 'montserratBold', 'montserratRegular']);
  assert.ok(Object.values(a.fonts).every(p => p.startsWith('/dokumenty/fonts/') && p.endsWith('.ttf')));
});

test('zaświadczenia używają tła pionowego', () => {
  for (const kind of ['ukonczenie', 'pobyt', 'uczestnictwo']) {
    assert.equal(requiredAssets(kind).background, '/dokumenty/tlo-zaswiadczenie.jpg', kind);
  }
});
