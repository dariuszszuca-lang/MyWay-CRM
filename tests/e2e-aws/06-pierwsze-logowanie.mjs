// Pierwsze logowanie nowej osoby z zespołu: hasło tymczasowe z zaproszenia -> własne hasło -> wejście do CRM.
// BEZ kodu z telefonu (decyzja Darka 04.10.2026). Konto testowe jest zakładane na czas testu i potem usuwane.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { ADRES, podsumuj, przegladarka, sprawdz } from './wspolne.mjs';

const POOL = 'eu-central-1_W4CJ896Wx';
const EMAIL = `crm-pierwsze-${randomBytes(3).toString('hex')}@example.com`;
const haslo = () => `${randomBytes(9).toString('base64url')}Aa1!x`;
const TYMCZASOWE = haslo();
const WLASNE = haslo();
const aws = (...args) => execFileSync('aws', [...args, '--region', 'eu-central-1', '--output', 'text'], { env: { ...process.env, AWS_PROFILE: 'myway-prod' }, encoding: 'utf8' }).trim();

aws('cognito-idp', 'admin-create-user', '--user-pool-id', POOL, '--username', EMAIL, '--temporary-password', TYMCZASOWE, '--message-action', 'SUPPRESS',
  '--user-attributes', `Name=email,Value=${EMAIL}`, 'Name=email_verified,Value=true', 'Name=name,Value=Test Pierwsze', '--query', 'User.UserStatus');
aws('cognito-idp', 'admin-add-user-to-group', '--user-pool-id', POOL, '--username', EMAIL, '--group-name', 'zespol');
const sub = aws('cognito-idp', 'admin-get-user', '--user-pool-id', POOL, '--username', EMAIL, '--query', 'UserAttributes[?Name==`sub`].Value');
aws('dynamodb', 'put-item', '--table-name', 'crm-uprawnienia', '--item', JSON.stringify({ pk: { S: sub }, sk: { S: 'testowy' }, rola: { S: 'konto-testowe' } }));

const { b, strona, bledy } = await przegladarka();
try {
  await strona.goto(ADRES);
  await strona.getByLabel('E-mail').fill(EMAIL);
  await strona.getByLabel('Hasło').fill(TYMCZASOWE);
  await strona.getByRole('button', { name: 'Zaloguj się' }).click();
  await strona.getByRole('heading', { name: 'Ustaw własne hasło' }).waitFor({ timeout: 20000 });
  sprawdz('pierwsze logowanie: prośba o własne hasło', true);

  await strona.getByLabel('Nowe hasło', { exact: true }).fill('krotkie');
  await strona.getByLabel('Powtórz nowe hasło').fill('krotkie');
  sprawdz('za krótkie hasło: formularz nie przechodzi dalej', !(await strona.getByLabel('Nowe hasło', { exact: true }).evaluate((el) => el.checkValidity())));

  await strona.getByLabel('Nowe hasło', { exact: true }).fill(WLASNE);
  await strona.getByLabel('Powtórz nowe hasło').fill(WLASNE);
  await strona.getByRole('button', { name: 'Ustaw hasło' }).click();
  await strona.getByRole('navigation', { name: 'Menu główne' }).waitFor({ timeout: 25000 });
  sprawdz('po ustawieniu hasła: wejście do CRM BEZ pytania o kod z telefonu', (await strona.getByRole('heading', { name: /Kod z telefonu|Dodaj kod w telefonie/ }).count()) === 0);
  sprawdz('nagłówek pokazuje e-mail nowej osoby', (await strona.locator('header').innerText()).includes(EMAIL));

  await strona.getByRole('button', { name: /Baza \(/ }).click();
  await strona.getByRole('heading', { name: 'Lista Pacjentów' }).waitFor({ timeout: 20000 });
  await strona.waitForTimeout(1500);
  sprawdz('dane z API dostępne (lista pacjentów ośrodka testowego)', (await strona.locator('tbody tr').count()) > 0);

  // Wylogowanie i ponowne logowanie własnym hasłem.
  strona.once('dialog', (d) => d.accept());
  await strona.getByRole('button', { name: 'Wyloguj się' }).click();
  await strona.getByLabel('E-mail').waitFor({ timeout: 15000 });
  await strona.getByLabel('E-mail').fill(EMAIL);
  await strona.getByLabel('Hasło').fill(WLASNE);
  await strona.getByRole('button', { name: 'Zaloguj się' }).click();
  await strona.getByRole('navigation', { name: 'Menu główne' }).waitFor({ timeout: 25000 });
  sprawdz('kolejne logowanie: sam e-mail i hasło, bez kodu', true);

  const istotne = bledy.filter((x) => !x.includes('cognito-idp') && !x.startsWith('Failed to load resource'));
  sprawdz('konsola bez błędów', istotne.length === 0, istotne.join(' || '));
} catch (e) {
  sprawdz('test przerwany wyjątkiem', false, String(e).slice(0, 300));
  await strona.screenshot({ path: `${process.env.ZRZUTY || '.'}/blad.png` }).catch(() => {});
} finally {
  await b.close();
  // Sprzątanie: konto i uprawnienie testowe znikają niezależnie od wyniku.
  try { aws('cognito-idp', 'admin-delete-user', '--user-pool-id', POOL, '--username', EMAIL); } catch (e) { console.log('nie usunięto konta:', String(e).slice(0, 120)); }
  try { aws('dynamodb', 'delete-item', '--table-name', 'crm-uprawnienia', '--key', JSON.stringify({ pk: { S: sub }, sk: { S: 'testowy' } })); } catch (e) { console.log('nie usunięto uprawnienia'); }
}
process.exit(podsumuj());
