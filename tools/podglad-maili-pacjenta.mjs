#!/usr/bin/env node
// Podgląd maila powitalnego i pożegnalnego z functions/index.js bez Firebase.
// Użycie: node tools/podglad-maili-pacjenta.mjs [katalog_wyjściowy]
// Wycina same funkcje szablonów (get*Email*, getAppSection*) i renderuje do HTML/TXT.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
const start = src.indexOf('// Aplikacja MyWay (PWA)');
const end = src.indexOf('// CLOUD FUNCTIONS');
if (start < 0 || end < 0) throw new Error('Nie znaleziono sekcji szablonów w functions/index.js');
const templates = src.slice(start, end);

const api = new Function(`${templates}
return { getWelcomeEmailHtml, getWelcomeEmailPlain, getFarewellEmailHtml, getFarewellEmailPlain };`)();

const outDir = process.argv[2] || join(process.cwd(), 'tmp-podglad-maili');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'powitalny.html'), api.getWelcomeEmailHtml('Anna', '3', '01.10.2026', '29.10.2026', '3days'));
writeFileSync(join(outDir, 'powitalny.txt'), api.getWelcomeEmailPlain('Anna', '3', '01.10.2026', '3days'));
writeFileSync(join(outDir, 'pozegnalny.html'), api.getFarewellEmailHtml('Anna', '3'));
writeFileSync(join(outDir, 'pozegnalny.txt'), api.getFarewellEmailPlain('Anna', '3'));
console.log('Podgląd zapisany w', outDir);
