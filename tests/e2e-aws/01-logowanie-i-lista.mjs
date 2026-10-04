// Logowanie z kodem z telefonu i lista pacjentów (PESEL widoczny, adres dopiero po kliknięciu).
import { ADRES, konto, podsumuj, przegladarka, sprawdz, zaloguj } from './wspolne.mjs';

const ZRZUT = process.env.ZRZUTY || '.';
const { b, strona, bledy } = await przegladarka();
try {
  await strona.goto(ADRES);
  sprawdz('ekran logowania: pola e-mail i hasło', await strona.getByLabel('E-mail').isVisible() && await strona.getByLabel('Hasło').isVisible());
  await strona.getByLabel('E-mail').fill('crm-test-1@example.com');
  await strona.getByLabel('Hasło').fill('zle-haslo-Zle-haslo-1!');
  await strona.getByRole('button', { name: 'Zaloguj się' }).click();
  await strona.getByRole('alert').waitFor({ timeout: 15000 });
  sprawdz('złe hasło: komunikat po polsku, bez wejścia', (await strona.getByRole('alert').innerText()).includes('Niepoprawny e-mail albo hasło'));

  await zaloguj(strona, konto('crm-test-1@example.com'));
  sprawdz('logowanie z kodem z telefonu: wejście do CRM', await strona.getByRole('navigation', { name: 'Menu główne' }).isVisible());
  sprawdz('nagłówek pokazuje zalogowany e-mail', (await strona.locator('header').innerText()).includes('crm-test-1@example.com'));
  const menu = await strona.getByRole('navigation', { name: 'Menu główne' }).innerText();
  sprawdz('menu jak w obecnym CRM: Rejestracja, Baza, Kolejka, Pokoje, Raporty, Dziennik, Telefony; bez Statystyk dla konta bez grupy',
    ['Rejestracja', 'Baza', 'Kolejka', 'Pokoje', 'Raporty', 'Dziennik', 'Telefony'].every((x) => menu.includes(x)) && !menu.includes('Statystyki'), menu.replace(/\n/g, ' | '));
  sprawdz('brak przycisku „Kopia” (pobranie całej bazy)', (await strona.getByRole('button', { name: /Kopia|kopię bazy/ }).count()) === 0);

  await strona.getByRole('button', { name: /Baza \(/ }).click();
  await strona.getByRole('heading', { name: 'Lista Pacjentów' }).waitFor();
  await strona.waitForTimeout(1500);
  const wiersze = strona.locator('tbody tr');
  const ile = await wiersze.count();
  sprawdz('lista: są fikcyjni pacjenci ośrodka testowy', ile >= 3, ile);
  // Wiersz pacjenta założonego przez testy API z PESEL-em i adresem (nie każdy fikcyjny pacjent je ma).
  const pierwszy = strona.locator('tbody tr', { hasText: 'Fikcyjny' }).first();
  const tekst = await pierwszy.innerText();
  sprawdz('wiersz: PESEL widoczny (11 cyfr)', /PESEL: \d{11}/.test(tekst), tekst.slice(0, 120));
  sprawdz('wiersz: adres ukryty do kliknięcia', tekst.includes('Pokaż adres i e-mail') && !tekst.includes('ul. Testowa'));
  await pierwszy.getByRole('button', { name: 'Pokaż adres i e-mail' }).click();
  await pierwszy.getByText('ul. Testowa').waitFor({ timeout: 15000 });
  sprawdz('po kliknięciu: adres pobrany z karty', (await pierwszy.innerText()).includes('ul. Testowa'));
  await strona.screenshot({ path: `${ZRZUT}/lista.png` });
  // Pomijamy: odpowiedź 400 z Cognito na celowo złe hasło oraz ogólne komunikaty „Failed to load resource”
  // (każde nieudane zapytanie jest i tak zapisane osobno z adresem jako „HTTP …”).
  const istotne = bledy.filter((x) => !x.includes('cognito-idp') && !x.startsWith('Failed to load resource'));
  sprawdz('konsola przeglądarki bez błędów i nieudanych zapytań do API', istotne.length === 0, istotne.join(' || '));
} catch (e) {
  sprawdz('test przerwany wyjątkiem', false, String(e).slice(0, 300));
  await strona.screenshot({ path: `${ZRZUT}/blad.png` }).catch(() => {});
} finally {
  await b.close();
}
process.exit(podsumuj());
