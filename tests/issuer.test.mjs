import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ISSUER } from '../services/issuer.ts';

test('dane wydawcy dokumentów wypisowych: nowa spółka z NIP i adresem ośrodka', () => {
  assert.equal(ISSUER.name, 'Ośrodek MyWay Sp. z o.o.');
  assert.equal(ISSUER.nip, '588-254-52-17');
  assert.equal(ISSUER.address, 'ul. Wichrowe Wzgórza 21, 84-200 Kąpino');
});

test('dokumenty wypisowe biorą wydawcę z issuer.ts i nie mają starej spółki', () => {
  const src = readFileSync('services/dischargeDocuments.ts', 'utf8');
  assert.ok(src.includes("from './issuer.ts'"), 'brak importu issuer.ts');
  assert.equal(src.includes('Bella Vita'), false);
  assert.ok(src.includes('ISSUER.nip'), 'NIP nie jest użyty na dokumentach');
});

// Umowa, karta uczestnika i regulamin (pdfGenerator.ts) ZOSTAJĄ na starej spółce, decyzja Darka 21.08.2026.
test('umowa nadal wystawiana przez dotychczasową spółkę (nie zmieniać bez decyzji Darka)', () => {
  const src = readFileSync('services/pdfGenerator.ts', 'utf8');
  assert.ok(src.includes('Bella Vita 3City'));
});
