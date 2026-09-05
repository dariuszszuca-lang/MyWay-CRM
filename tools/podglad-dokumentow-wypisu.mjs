// Podgląd dokumentów pacjenta bez przeglądarki (Node 22.18+ czyta .ts bez transpilacji).
// Użycie: node tools/podglad-dokumentow-wypisu.mjs [katalog_wyjściowy]
// Renderuje komplet dla pacjenta wypisanego (5 dokumentów) i aktywnego (3) do podkatalogów.
// PNG do obejrzenia: pdftoppm -png -r 70 plik.pdf plik   (albo sips dla pierwszej strony)
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { availableDocuments, generateDischargeDocument, documentFileName } from '../services/dischargeDocuments.ts';

const out = process.argv[2] || 'tmp-podglad-dokumentow';
// te same zasoby co w przeglądarce, czytane z public/ (ścieżki zaczynają się od /dokumenty/)
const loadAsset = async (p) => { const b = await readFile(new URL(`../public${p}`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const discharged = {
  firstName: 'Anna', lastName: 'Przykładowa', pesel: '90010112344', package: '3',
  treatmentStartDate: '2026-06-15', treatmentEndDate: '2026-07-13',
  status: 'discharged', dischargeType: 'completed', dischargeDate: '2026-07-13',
};
const active = { ...discharged, firstName: 'Jan', lastName: 'Przykładowy', pesel: '85042967215', status: 'active', dischargeType: undefined, dischargeDate: undefined };
for (const [folder, patient] of [['wypisany', discharged], ['aktywny', active]]) {
  mkdirSync(`${out}/${folder}`, { recursive: true });
  for (const kind of availableDocuments(patient)) {
    const doc = await generateDischargeDocument(kind, patient, { today: '2026-09-05', loadAsset });
    const file = `${out}/${folder}/${documentFileName(kind, patient)}`;
    writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
    console.log('OK', file);
  }
}
