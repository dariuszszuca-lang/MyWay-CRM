// Podgląd 4 dokumentów wypisowych bez przeglądarki (Node 22.18+ czyta .ts bez transpilacji).
// Użycie: node tools/podglad-dokumentow-wypisu.mjs [katalog_wyjściowy]
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { availableDocuments, generateDischargeDocument, documentFileName } from '../services/dischargeDocuments.ts';

const out = process.argv[2] || 'tmp-podglad-dokumentow';
// te same zasoby co w przeglądarce, czytane z public/ (ścieżki zaczynają się od /dokumenty/)
const loadAsset = async (p) => { const b = await readFile(new URL(`../public${p}`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
mkdirSync(out, { recursive: true });
const patient = {
  firstName: 'Anna', lastName: 'Przykładowa', pesel: '90010112344', package: '3',
  treatmentStartDate: '2026-06-15', treatmentEndDate: '2026-07-13',
  status: 'discharged', dischargeType: 'completed', dischargeDate: '2026-07-13',
};
for (const kind of availableDocuments(patient)) {
  const doc = await generateDischargeDocument(kind, patient, { today: '2026-08-21', loadAsset });
  const file = `${out}/${documentFileName(kind, patient)}`;
  writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  console.log('OK', file);
}
