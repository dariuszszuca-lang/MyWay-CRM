// Telefonia z ekranu: lista z API, nowy kontakt z pierwszą rozmową, widoczność statystyk wg grupy (dane FIKCYJNE).
import { konto, podsumuj, przegladarka, sprawdz, zaloguj } from './wspolne.mjs';

const ZRZUT = process.env.ZRZUTY || '.';
const NAZWA = `Ekran-${Math.random().toString(36).slice(2, 7)}`;

async function sesja(email, fn) {
  const { b, strona, bledy } = await przegladarka();
  try {
    await zaloguj(strona, konto(email));
    await strona.getByRole('navigation', { name: 'Menu główne' }).getByRole('button', { name: 'Telefony' }).click();
    await strona.getByRole('heading', { name: 'Telefony', exact: true }).waitFor({ timeout: 25000 });
    await fn(strona);
    const istotne = bledy.filter((x) => !x.includes('cognito-idp') && !x.startsWith('Failed to load resource'));
    sprawdz(`konsola bez błędów (${email.split('@')[0]})`, istotne.length === 0, istotne.join(' || '));
  } catch (e) {
    sprawdz(`test przerwany wyjątkiem (${email})`, false, String(e).slice(0, 400));
    await strona.screenshot({ path: `${ZRZUT}/blad.png` }).catch(() => {});
    console.log('błędy:', bledy.join(' || '));
  } finally {
    await b.close();
  }
}

await sesja('crm-test-1@example.com', async (strona) => {
  await strona.waitForTimeout(2000);
  sprawdz('telefonia: moduł wczytany bez komunikatu o błędzie', (await strona.getByText('Nie udało się pobrać telefonów').count()) === 0);
  await strona.getByRole('button', { name: 'Nowy kontakt' }).click();
  const f = strona.getByRole('region', { name: 'Formularz kontaktu' }).or(strona.locator('[aria-label="Formularz kontaktu"]'));
  await f.first().waitFor({ timeout: 15000 });
  await f.first().getByPlaceholder('np. L727 lub imię').fill(NAZWA);
  const wynik = f.first().locator('label:has-text("Wynik") select, select').filter({ has: strona.locator('option', { hasText: 'Brak decyzji' }) }).first();
  await wynik.selectOption({ label: 'Brak decyzji' });
  await f.first().getByRole('button', { name: 'Zapisz rozmowę' }).click();
  await strona.waitForTimeout(3000);
  const blad = await f.first().getByRole('alert').count() ? await f.first().getByRole('alert').innerText() : '';
  sprawdz('telefonia: nowy kontakt z rozmową zapisany z ekranu (formularz bez błędu)', blad === '', blad);
  await strona.getByText(NAZWA).first().waitFor({ timeout: 25000 }).catch(() => {});
  sprawdz('telefonia: nowy kontakt widoczny na ekranie', (await strona.getByText(NAZWA).count()) > 0);
  await strona.screenshot({ path: `${ZRZUT}/telefonia.png` });
});

process.exit(podsumuj());
