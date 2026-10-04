// Wspólne narzędzia testów przeglądarkowych gałęzi aws (dane FIKCYJNE, konta testowe z ~/.secrets).
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

export const ADRES = process.env.CRM_URL || 'http://localhost:5173';
const sekrety = JSON.parse(readFileSync(`${homedir()}/.secrets/myway-crm-testy.json`, 'utf8'));
export const konto = (email) => ({ email, ...sekrety[email] });

function base32(s) {
  const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bity = '';
  for (const z of s.replace(/=+$/, '').toUpperCase()) bity += alfabet.indexOf(z).toString(2).padStart(5, '0');
  return Buffer.from(bity.match(/.{8}/g).map((b) => parseInt(b, 2)));
}
export function totp(sekret, krok = Math.floor(Date.now() / 30000)) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(krok));
  const h = createHmac('sha1', base32(sekret)).update(b).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
// Cognito nie przyjmie drugi raz kodu z tego samego okna 30 s: czekamy na początek następnego.
export async function swiezyKod(sekret) {
  const doKonca = 30000 - (Date.now() % 30000);
  await new Promise((r) => setTimeout(r, doKonca + 500));
  return totp(sekret);
}

export async function przegladarka() {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const strona = await (await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pl-PL' })).newPage();
  const bledy = [];
  strona.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
  strona.on('pageerror', (e) => bledy.push(`pageerror: ${String(e).slice(0, 200)}`));
  // Nieudane zapytania z adresem (bez parametrów), żeby było widać, czego dotyczy błąd w konsoli.
  strona.on('response', (r) => { if (r.status() >= 400) bledy.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/\?.*/, '')}`); });
  return { b, strona, bledy };
}

export async function zaloguj(strona, k) {
  await strona.goto(ADRES);
  await strona.getByLabel('E-mail').fill(k.email);
  await strona.getByLabel('Hasło').fill(k.haslo);
  await strona.getByRole('button', { name: 'Zaloguj się' }).click();
  await strona.getByRole('heading', { name: 'Kod z telefonu' }).waitFor({ timeout: 20000 });
  await strona.getByLabel('Kod z aplikacji').fill(await swiezyKod(k.totp));
  await strona.getByRole('button', { name: 'Wejdź' }).click();
  await strona.getByRole('navigation', { name: 'Menu główne' }).waitFor({ timeout: 20000 });
}

const wyniki = [];
export const sprawdz = (nazwa, ok, szczegol = '') => { wyniki.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${nazwa}${!ok && szczegol ? `  (${szczegol})` : ''}`); };
export const podsumuj = () => { const z = wyniki.filter(Boolean).length; console.log(`\nWYNIK: ${z}/${wyniki.length} PASS`); return z === wyniki.length ? 0 : 1; };
