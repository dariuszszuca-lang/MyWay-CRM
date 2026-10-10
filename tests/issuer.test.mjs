import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ISSUER } from '../services/issuer.ts';

test('dane wydawcy dokumentów wypisowych: nowa spółka z NIP i adresem ośrodka', () => {
  assert.equal(ISSUER.name, 'My Way Ośrodek Sp. z o.o.'); // nazwa rejestrowa wg KRS 0001226258
  assert.equal(ISSUER.nip, '588-254-52-17');
  assert.equal(ISSUER.address, 'ul. Wichrowe Wzgórza 21, 84-200 Kąpino');
});

test('dokumenty wypisowe biorą wydawcę z issuer.ts i nie mają starej spółki', () => {
  const src = readFileSync('services/dischargeDocuments.ts', 'utf8');
  assert.ok(src.includes("from './issuer.ts'"), 'brak importu issuer.ts');
  assert.equal(src.includes('Bella Vita'), false);
  assert.ok(src.includes('ISSUER.nip'), 'NIP nie jest użyty na dokumentach');
});

// Umowa: od decyzji Darka 06.10.2026 spółkę wybiera się w oknie przed wydrukiem.
// Domyślna zostaje dotychczasowa spółka (Bella Vita 3City). Nie zmieniać domyślnej bez decyzji Darka.
test('umowa: domyślnie dotychczasowa spółka, nowa tylko z wyboru (nie zmieniać bez decyzji Darka)', () => {
  const src = readFileSync('services/pdfGenerator.ts', 'utf8');
  assert.match(src, /generateContract = async \(patient: Patient, issuerKey: ContractIssuerKey = 'bella'\)/, 'domyślna spółka umowy nie jest już Bella Vita');
  assert.ok(src.includes('CONTRACT_ISSUERS[issuerKey]'), 'umowa nie bierze spółki z wyboru');
  assert.equal(src.includes('ISSUER.'), false, 'umowa nie może brać wydawcy dokumentów wypisowych');
  const wydawcy = readFileSync('services/issuer.ts', 'utf8');
  assert.ok(wydawcy.includes("label: 'Bella Vita 3City Sp. z o.o.'"), 'brak dotychczasowej spółki na liście');
  assert.ok(wydawcy.includes("label: 'My Way Ośrodek Sp. z o.o.'"), 'brak nowej spółki na liście');
  assert.ok(wydawcy.includes('KRS: 0000644953') && wydawcy.includes('KRS: 0001226258'), 'brak numerów KRS spółek');
});
