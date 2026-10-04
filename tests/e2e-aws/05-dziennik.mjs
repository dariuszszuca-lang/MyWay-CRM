// Dziennik: nowy CRM woła ordersApi w EduWay z tokenem tożsamości Cognito.
// Konto testowe NIE jest na liście dostępu do Dziennika, więc poprawny wynik to odmowa 403
// (403 = podpis tokenu przyjęty, adres spoza listy; 401 oznaczałoby, że funkcja nie rozumie nowego logowania).
import { konto, podsumuj, przegladarka, sprawdz, zaloguj } from './wspolne.mjs';

const { b, strona } = await przegladarka();
const odpowiedzi = [];
const szczegoly = [];
strona.on('response', async (r) => {
  if (!r.url().includes('cloudfunctions.net/ordersApi')) return;
  odpowiedzi.push(r.status());
  let klucze = '';
  try { klucze = Object.keys(await r.json()).join(','); } catch { klucze = '(bez treści)'; }
  szczegoly.push(`${r.request().method()} ${r.url().replace(/.*ordersApi/, '')} -> ${r.status()} [pola odpowiedzi: ${klucze}]`);
});
try {
  await zaloguj(strona, konto('crm-test-1@example.com'));
  await strona.getByRole('navigation', { name: 'Menu główne' }).getByRole('button', { name: 'Dziennik' }).click();
  await strona.getByRole('heading', { name: 'Dziennik', exact: true }).waitFor({ timeout: 20000 });
  await strona.waitForTimeout(5000);
  sprawdz('Dziennik: zapytanie doszło do ordersApi (CORS z adresu lokalnego dozwolony albo odmowa po stronie funkcji)', odpowiedzi.length > 0, odpowiedzi.join(','));
  sprawdz('Dziennik: konto spoza listy dostaje 403 (token przyjęty, adres odrzucony), nie 401', odpowiedzi.includes(403) && !odpowiedzi.includes(401) && !odpowiedzi.includes(200), odpowiedzi.join(','));
} catch (e) {
  sprawdz('test przerwany wyjątkiem', false, String(e).slice(0, 300));
} finally {
  console.log(szczegoly.join('\n'));
  await b.close();
}
process.exit(podsumuj());
