import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const functionsIndex = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');

test('sekcja aplikacji MyWay ma adres PWA i hostowany obrazek QR', () => {
  assert.match(functionsIndex, /const APP_URL = "https:\/\/myway-app-d3b78\.web\.app"/);
  assert.match(functionsIndex, /const APP_QR_IMG = "https:\/\/osrodek-myway\.pl\/aplikacja-myway-qr\.png"/);
});

test('mail powitalny i pożegnalny wstawiają sekcję aplikacji w HTML i w wersji tekstowej', () => {
  assert.match(functionsIndex, /\$\{getAppSectionHtml\("welcome"\)\}/);
  assert.match(functionsIndex, /\$\{getAppSectionHtml\("farewell"\)\}/);
  assert.match(functionsIndex, /\$\{getAppSectionPlain\("welcome"\)\}/);
  assert.match(functionsIndex, /\$\{getAppSectionPlain\("farewell"\)\}/);
});

test('sekcja aplikacji zawiera instrukcję instalacji dla iPhone i Android', () => {
  assert.match(functionsIndex, /Dodaj do ekranu początkowego/);
  assert.match(functionsIndex, /Zainstaluj aplikację/);
});
