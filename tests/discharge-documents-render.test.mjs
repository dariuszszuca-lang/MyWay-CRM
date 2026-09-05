import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { availableDocuments, generateDischargeDocument } from '../services/dischargeDocuments.ts';

// Render w Node na tych samych zasobach co przeglądarka (public/dokumenty). Pilnuje, że treść
// zaświadczeń mieści się na jednej stronie, a oświadczenie pacjenta na dwóch, także przy pustych polach.
const loadAsset = async (p) => {
  const b = await readFile(new URL(`../public${p}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

const discharged = {
  firstName: 'Anna', lastName: 'Przykładowa', pesel: '90010112344', package: '3',
  treatmentStartDate: '2026-06-15', treatmentEndDate: '2026-07-13',
  status: 'discharged', dischargeType: 'completed', dischargeDate: '2026-07-13',
};
const active = { ...discharged, status: 'active', dischargeType: undefined, dischargeDate: undefined };
const EXPECTED_PAGES = { dyplom: 1, ukonczenie: 1, pobyt: 1, uczestnictwo: 1, oswiadczenie: 2 };

for (const [label, patient] of [['wypisany', discharged], ['aktywny', active]]) {
  test(`liczba stron dokumentów: pacjent ${label}`, async () => {
    for (const kind of availableDocuments(patient)) {
      const doc = await generateDischargeDocument(kind, patient, { today: '2026-09-05', loadAsset });
      assert.equal(doc.getNumberOfPages(), EXPECTED_PAGES[kind], kind);
    }
  });
}

test('oświadczenie pacjenta bez PESEL i daty przyjęcia renderuje się (puste pola = kropki)', async () => {
  const doc = await generateDischargeDocument('oswiadczenie', { ...active, pesel: '', treatmentStartDate: '' }, { today: '2026-09-05', loadAsset });
  assert.equal(doc.getNumberOfPages(), 2);
});
