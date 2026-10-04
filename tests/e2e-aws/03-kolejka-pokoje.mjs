// Kolejka, rezerwacja pokoju i przyjęcie z kolejki z ekranu (dane FIKCYJNE).
import { konto, podsumuj, przegladarka, sprawdz, zaloguj } from './wspolne.mjs';

const ZRZUT = process.env.ZRZUTY || '.';
const znak = Math.random().toString(36).slice(2, 7);
const NAZWISKO = `Kolejka-${znak}`;
const POKOJ = `E${znak}`.slice(0, 6);
const pesel = (() => {
  const c = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10));
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  return c.join('') + String(((10 - (c.reduce((s, x, i) => s + x * w[i], 0) % 10)) % 10 + 5) % 10);
})();

const { b, strona, bledy } = await przegladarka();
const komunikaty = [];
strona.on('dialog', async (d) => { komunikaty.push(d.message()); await d.accept(d.type() === 'prompt' ? 'test z ekranu' : undefined); });
const zakladka = (n) => strona.getByRole('navigation', { name: 'Menu główne' }).getByRole('button', { name: n });
const karta = () => strona.locator('div', { hasText: NAZWISKO }).filter({ has: strona.getByRole('button', { name: 'Przyjmij' }) }).last();

try {
  await zaloguj(strona, konto('crm-test-1@example.com'));

  // --- nowa osoba w kolejce z zaliczką i detoksem ---
  await zakladka(/Kolejka/).click();
  const f = strona.locator('form').first();
  await f.locator('[name="firstName"]').fill('Kuba');
  await f.locator('[name="lastName"]').fill(NAZWISKO);
  await f.locator('[name="phone"]').fill('000555666');
  await f.locator('[name="pesel"]').fill(pesel);
  await f.locator('[name="birthDate"]').fill('1985-05-05');
  await f.locator('[name="address"]').fill('ul. Kolejkowa 7, 00-000 Testowo');
  await f.locator('[name="package"]').selectOption('8tyg');
  await f.locator('[name="depositAmount"]').fill('1500');
  await f.locator('[name="plannedStartDate"]').fill('2026-10-06');
  await f.locator('[name="plannedEndDate"]').fill('2026-12-01');
  await f.getByText('Detoks 1 dzień').click();
  await f.getByRole('button', { name: 'Dodaj do kolejki' }).click();
  await strona.getByText(NAZWISKO).first().waitFor({ timeout: 20000 });
  sprawdz('kolejka: osoba dodana i widoczna', komunikaty.some((k) => k.includes('Dodano do kolejki')), komunikaty.join(' | '));

  await strona.getByTitle(/Potwierdź termin/).last().click();
  await strona.waitForTimeout(2500);
  sprawdz('kolejka: potwierdzenie z informacją, że mail nie wyszedł (podgląd)', komunikaty.some((k) => k.includes('potwierdzony') && k.includes('Mail powitalny nie został wysłany')), komunikaty.slice(-1)[0]);

  // --- pokój i rezerwacja dla osoby z kolejki ---
  await zakladka('Pokoje').click();
  await strona.getByRole('button', { name: 'Zarządzanie pokojami' }).click();
  await strona.getByRole('button', { name: 'Dodaj pokój' }).click();
  await strona.getByPlaceholder('Numer (np. 11)').fill(POKOJ);
  await strona.getByPlaceholder('Pojemność').fill('1');
  await strona.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await strona.getByText(POKOJ).first().waitFor({ timeout: 20000 });
  sprawdz('pokoje: nowy pokój 1-osobowy na liście', true);

  await strona.getByRole('button', { name: 'Przypisania' }).click();
  const wyborOsoby = strona.locator('select').filter({ has: strona.locator('option', { hasText: '— Wybierz pacjenta —' }) });
  await wyborOsoby.selectOption(await wyborOsoby.locator('option', { hasText: NAZWISKO }).getAttribute('value'));
  const wyborPokoju = strona.locator('select').filter({ has: strona.locator('option', { hasText: '— Pokój —' }) });
  await wyborPokoju.selectOption(await wyborPokoju.locator('option', { hasText: `Pokój ${POKOJ} ` }).getAttribute('value'));
  await strona.getByTitle('Od kiedy w pokoju').fill('2026-10-06');
  await strona.getByRole('button', { name: 'Zarezerwuj' }).click();
  await strona.waitForTimeout(2500);
  sprawdz('pokoje: rezerwacja dla osoby z kolejki', komunikaty.some((k) => k.includes('zarezerwowany')), komunikaty.slice(-1)[0]);

  // --- przyjęcie z kolejki ---
  await zakladka(/Kolejka/).click();
  await strona.getByRole('button', { name: 'Przyjmij' }).last().click();
  await strona.getByRole('heading', { name: 'Rejestracja Pacjenta' }).waitFor({ timeout: 20000 });
  const p = (n) => strona.locator(`form [name="${n}"]`);
  sprawdz('przyjęcie: formularz wypełniony pełnymi danymi z kolejki (PESEL, adres, terminy)',
    await p('pesel').inputValue() === pesel && await p('address').inputValue() === 'ul. Kolejkowa 7, 00-000 Testowo' && await p('treatmentStartDate').inputValue() === '2026-10-06');
  await p('idSeries').fill('ABC000003');
  await p('email').fill('kuba.kolejka@example.com');
  await p('voivodeship').fill('pomorskie');
  await p('totalAmount').fill('16000');
  await strona.getByRole('button', { name: 'Zapisz Pacjenta' }).click();
  await strona.getByRole('heading', { name: 'Lista Pacjentów' }).waitFor({ timeout: 25000 });
  const wiersz = strona.locator('tbody tr', { hasText: NAZWISKO });
  await wiersz.waitFor({ timeout: 20000 });
  await strona.waitForFunction((n) => [...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(n) && /15\s?500,00/.test(r.textContent)), NAZWISKO, { timeout: 20000 }).catch(() => {});
  const tekst = (await wiersz.innerText()).replace(/\s+/g, ' ');
  sprawdz('przyjęcie: do zapłaty 15 500 (16 000 + detoks 1 000 - zaliczka 1 500), nic nie zdublowane', /15\s?500,00/.test(tekst), tekst.slice(0, 300));

  await zakladka(/Kolejka/).click();
  await strona.waitForTimeout(1500);
  sprawdz('przyjęcie: osoba znika z kolejki', (await strona.getByText(NAZWISKO).count()) === 0);

  await zakladka('Pokoje').click();
  await strona.getByRole('button', { name: 'Przypisania' }).click();
  await strona.waitForTimeout(1500);
  const wybor2 = strona.locator('select').filter({ has: strona.locator('option', { hasText: '— Wybierz pacjenta —' }) });
  const jakoPacjent = await wybor2.locator('option', { hasText: NAZWISKO }).getAttribute('value');
  sprawdz('pokoje: przyjęta osoba jest teraz na liście pacjentów (nie kolejki)', String(jakoPacjent).startsWith('patient:'), jakoPacjent);
  await wybor2.selectOption(jakoPacjent);
  await strona.waitForTimeout(800);
  sprawdz('pokoje: rezerwacja z kolejki przeszła na pacjenta', (await strona.locator('main').innerText()).includes(POKOJ));
  await strona.screenshot({ path: `${ZRZUT}/pokoje.png` });

  const istotne = bledy.filter((x) => !x.includes('cognito-idp') && !x.startsWith('Failed to load resource'));
  sprawdz('konsola bez błędów i nieudanych zapytań do API', istotne.length === 0, istotne.join(' || '));
} catch (e) {
  sprawdz('test przerwany wyjątkiem', false, String(e).slice(0, 400));
  await strona.screenshot({ path: `${ZRZUT}/blad.png` }).catch(() => {});
  console.log('komunikaty:', komunikaty.join(' | '), '\nbłędy:', bledy.join(' || '));
} finally {
  await b.close();
}
process.exit(podsumuj());
