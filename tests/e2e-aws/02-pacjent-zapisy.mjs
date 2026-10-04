// Zapisy z ekranu na danych FIKCYJNYCH: nowy pacjent z wpłatą, edycja karty, wpłata z listy, wypis, przywrócenie.
import { konto, podsumuj, przegladarka, sprawdz, zaloguj } from './wspolne.mjs';

const ZRZUT = process.env.ZRZUTY || '.';
const znak = Math.random().toString(36).slice(2, 7);
const NAZWISKO = `Ekranowa-${znak}`;
// PESEL z celowo złą sumą kontrolną: nie może pasować do prawdziwej osoby.
const pesel = (() => {
  const c = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10));
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const dobra = (10 - (c.reduce((s, x, i) => s + x * w[i], 0) % 10)) % 10;
  return c.join('') + String((dobra + 5) % 10);
})();

const { b, strona, bledy } = await przegladarka();
const komunikaty = [];
strona.on('dialog', async (d) => { komunikaty.push(d.message()); await d.accept(d.type() === 'prompt' ? 'test z ekranu' : undefined); });
const wiersz = () => strona.locator('tbody tr', { hasText: NAZWISKO });
const pole = (n) => strona.locator(`form [name="${n}"]`);

try {
  await zaloguj(strona, konto('crm-test-1@example.com'));

  // --- nowy pacjent z jedną wpłatą ---
  await strona.getByRole('button', { name: 'Rejestracja' }).click();
  await pole('firstName').fill('Ewelina');
  await pole('lastName').fill(NAZWISKO);
  await pole('pesel').fill(pesel);
  await pole('birthDate').fill('1990-01-01');
  await pole('voivodeship').fill('pomorskie');
  await pole('idSeries').fill('ABC000002');
  await pole('phone').fill('000111222');
  await pole('email').fill('ewelina.ekranowa@example.com');
  await pole('address').fill('ul. Ekranowa 5, 00-000 Testowo');
  await pole('treatmentStartDate').fill('2026-09-28');
  await pole('treatmentEndDate').fill('2026-11-09');
  await pole('package').selectOption('6tyg');
  await pole('totalAmount').fill('10000');
  await pole('paymentDeadline').fill('2026-10-20');
  await strona.getByRole('button', { name: 'Dodaj wpłatę' }).click();
  await strona.locator('label:has-text("Kwota (PLN)") + input').last().fill('2500');
  await strona.getByRole('button', { name: 'Zapisz Pacjenta' }).click();
  await strona.getByRole('heading', { name: 'Lista Pacjentów' }).waitFor({ timeout: 20000 });
  await wiersz().waitFor({ timeout: 20000 });
  sprawdz('nowy pacjent: komunikat o dodaniu i wiersz na liście', komunikaty.some((k) => k.includes('dodany do bazy')) && await wiersz().count() === 1, komunikaty.join(' | '));
  sprawdz('nowy pacjent: PESEL w wierszu', (await wiersz().innerText()).includes(pesel));
  await strona.waitForFunction((n) => [...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(n) && /7\s?500,00/.test(r.textContent)), NAZWISKO, { timeout: 20000 }).catch(() => {});
  sprawdz('nowy pacjent: do zapłaty 7 500 zł (10 000 minus wpłata 2 500)', /7\s?500,00/.test(await wiersz().innerText()), (await wiersz().innerText()).replace(/\s+/g, ' ').slice(0, 200));

  // --- edycja karty ---
  await wiersz().getByRole('button', { name: /Edytuj dane/ }).click();
  await strona.getByRole('button', { name: 'Zapisz Zmiany' }).waitFor({ timeout: 20000 });
  sprawdz('edycja: formularz ma dane z pełnej karty (adres, e-mail, dowód, termin płatności)',
    await pole('address').inputValue() === 'ul. Ekranowa 5, 00-000 Testowo' && await pole('email').inputValue() === 'ewelina.ekranowa@example.com'
    && await pole('idSeries').inputValue() === 'ABC000002' && await pole('paymentDeadline').inputValue() === '2026-10-20');
  sprawdz('edycja: wpłata 2 500 widoczna w karcie', await strona.locator('label:has-text("Kwota (PLN)") + input').first().inputValue() === '2500');
  await pole('phone').fill('000333444');
  await pole('totalAmount').fill('11000');
  await strona.getByRole('button', { name: 'Zapisz Zmiany' }).click();
  await strona.waitForFunction((n) => [...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(n) && r.textContent.includes('000333444') && /8\s?500,00/.test(r.textContent)), NAZWISKO, { timeout: 20000 }).catch(() => {});
  const poEdycji = (await wiersz().innerText()).replace(/\s+/g, ' ');
  sprawdz('edycja: nowy telefon na liście', poEdycji.includes('000333444'), poEdycji.slice(0, 200));
  sprawdz('edycja: zmiana kwoty pakietu na 11 000 daje 8 500 do zapłaty (wpłata nie zdublowana)', /8\s?500,00/.test(poEdycji), poEdycji.slice(0, 260));

  // --- wpłata z listy ---
  await wiersz().getByTitle('Rozlicz płatność').click();
  await strona.locator('label:has-text("Kwota nowej wpłaty") + div input').fill('500');
  await strona.getByRole('button', { name: 'Dodaj wpłatę' }).click();
  await strona.waitForFunction((n) => [...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(n) && /8\s?000,00/.test(r.textContent)), NAZWISKO, { timeout: 20000 }).catch(() => {});
  sprawdz('wpłata z listy 500: do zapłaty 8 000', /8\s?000,00/.test(await wiersz().innerText()), (await wiersz().innerText()).replace(/\s+/g, ' ').slice(0, 260));

  // --- wypis: zakończenie z długiem zablokowane, rezygnacja przechodzi ---
  await wiersz().getByRole('button', { name: 'Wypisz' }).click();
  await strona.getByText('Rezygnacja z terapii').click();
  await strona.getByRole('button', { name: 'Wypisz pacjenta' }).click();
  await strona.waitForFunction((n) => ![...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(n)), NAZWISKO, { timeout: 20000 }).catch(() => {});
  sprawdz('wypis (rezygnacja): pacjent znika z aktywnych', await wiersz().count() === 0, komunikaty.slice(-2).join(' | '));
  sprawdz('wypis: komunikat potwierdzenia', komunikaty.some((k) => k.includes('wypisany — Rezygnacja z terapii')), komunikaty.slice(-2).join(' | '));
  await strona.getByRole('button', { name: 'Wypisani', exact: true }).click();
  await wiersz().waitFor({ timeout: 15000 });
  sprawdz('wypisany jest na liście wypisanych', await wiersz().count() === 1);
  await strona.screenshot({ path: `${ZRZUT}/wypisany.png` });

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
