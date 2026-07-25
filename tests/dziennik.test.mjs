// Testy wpięcia zakładki "Dziennik" (zamówienia Dziennika MyWay).
// Styl jak w tests/payment-alert.test.mjs: sprawdzamy źródła, nie renderujemy.
// Uruchomienie: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const app = read('App.tsx');
const types = read('types.ts');
const api = read('services/ordersApi.ts');
const tab = read('components/DziennikTab.tsx');
const list = read('components/OrdersList.tsx');
const codes = read('components/CodesList.tsx');

test('App.tsx ma zakładkę dziennik wpiętą we wszystkich czterech miejscach', () => {
  assert.match(app, /import DziennikTab from '\.\/components\/DziennikTab'/, 'brak importu komponentu');
  assert.match(app, /type ActiveTab =[^;]*'dziennik'/, "brak 'dziennik' w typie ActiveTab");
  assert.match(app, /switchTab\('dziennik'\)/, 'brak przycisku w nawigacji');
  assert.match(app, /activeTab === 'dziennik' &&/, 'brak renderowania treści zakładki');
  assert.match(app, /<DziennikTab \/>/, 'komponent nie jest renderowany');
});

test('zakładka nie jest zamknięta na osobną listę dostępu (decyzja Darka: widzą wszyscy z CRM)', () => {
  assert.doesNotMatch(app, /canAccessDziennik/, 'pojawiła się osobna kontrola dostępu, a nie było takiej decyzji');
});

test('typy statusów zgadzają się z ustaleniami', () => {
  for (const status of ['new', 'accepted', 'packing', 'shipped', 'cancelled']) {
    assert.match(types, new RegExp(`'${status}'`), `brak statusu ${status}`);
  }
  const withEmail = types.match(/ORDER_STATUSES_WITH_EMAIL[^=]*=\s*\[([^\]]*)\]/);
  assert.ok(withEmail, 'brak listy statusów wysyłających mail');
  assert.doesNotMatch(withEmail[1], /'new'/, 'status "Zamówione" NIE może wysyłać maila (potwierdzenie idzie po płatności)');
  assert.doesNotMatch(withEmail[1], /'cancelled'/, 'anulowanie NIE wysyła maila');
  for (const status of ['accepted', 'packing', 'shipped']) {
    assert.match(withEmail[1], new RegExp(`'${status}'`), `status ${status} powinien wysyłać mail`);
  }
});

test('zamówienia idą do funkcji w projekcie EduWay, z tokenem zalogowanego', () => {
  assert.match(api, /europe-west1-eduway-f13c4\.cloudfunctions\.net\/ordersApi/, 'zły adres API');
  assert.match(api, /getIdToken\(\)/, 'brak tokenu użytkownika');
  assert.match(api, /Authorization: `Bearer \$\{token\}`/, 'token nie jest wysyłany w nagłówku');
});

test('CRM nie próbuje czytać zamówień wprost z bazy (nie ma ich w tym projekcie)', () => {
  for (const [nazwa, zrodlo] of [['DziennikTab', tab], ['OrdersList', list], ['ordersApi', api]]) {
    assert.doesNotMatch(zrodlo, /collection\(db,\s*'orders'\)/, `${nazwa} sięga do bazy CRM po zamówienia`);
    assert.doesNotMatch(zrodlo, /onSnapshot/, `${nazwa} nasłuchuje bazy CRM, a zamówienia tam nie leżą`);
  }
});

test('zmiana statusu wymaga potwierdzenia, żeby jeden klik nie wysłał maila do klienta', () => {
  assert.match(list, /window\.confirm/, 'brak potwierdzenia przed zmianą statusu');
  assert.match(list, /wysłać maila|wysłać maila do/i, 'potwierdzenie nie mówi, że poleci mail');
});

test('lista rozwijana jest blokowana w trakcie zapisu (ochrona przed dwuklikiem)', () => {
  assert.match(list, /disabled=\{isBusy\}/, 'brak blokady w trakcie zapisu');
});

test('nieudany mail jest widoczny i da się go ponowić', () => {
  assert.match(list, /Mail nie wyszedł/, 'brak informacji o nieudanym mailu');
  assert.match(list, /onResendEmail/, 'brak możliwości ponowienia');
  assert.match(api, /resendStatusEmail/, 'brak funkcji ponowienia w warstwie API');
});

test('brak adresu wysyłki jest oznaczony, bo bez adresu nie ma czego pakować', () => {
  assert.match(list, /Brak adresu, dopytaj klienta/, 'brak ostrzeżenia o pustym adresie');
});

// --- kody na darmowy Dziennik ---

test('kody są podzakładką w Dziennik, nie osobną pozycją w górnym menu', () => {
  assert.match(tab, /import CodesList from '\.\/CodesList'/, 'brak importu listy kodów');
  assert.match(tab, /<CodesList \/>/, 'kody nie są renderowane w zakładce Dziennik');
  assert.match(tab, /'zamowienia' \| 'kody'/, 'brak przełącznika podzakładek');
  assert.doesNotMatch(app, /switchTab\('kody'\)/, 'kody nie powinny być osobną zakładką w menu głównym');
});

test('trzy stany kodu są rozróżnione: wolny, wydany nieużyty, zrealizowany', () => {
  assert.match(types, /codeState/, 'brak funkcji rozstrzygającej stan kodu');
  for (const stan of ['free', 'issued', 'redeemed']) {
    assert.match(types, new RegExp(`'${stan}'`), `brak stanu ${stan}`);
  }
  assert.match(codes, /Wydany, nieużyty/, 'brak stanu wydany nieużyty w interfejsie');
  assert.match(codes, /Zrealizowany/, 'brak stanu zrealizowany');
});

test('realizacja kodu jest tylko do odczytu, bo o niej decyduje Stripe', () => {
  // W formularzu edycji wolno zmieniać wyłącznie warstwę ręczną
  const formularz = codes.match(/isEditing \? \([\s\S]*?\) : \(/g) || [];
  const polaEdycji = formularz.join(' ');
  assert.doesNotMatch(polaEdycji, /editForm\.redeemed|redeemed:/, 'nie wolno klikać realizacji kodu, to wie Stripe');
  assert.match(codes, /editForm\.issued/, 'brak zaznaczania wydania kodu');
  assert.match(codes, /editForm\.issuedTo/, 'brak pola komu wydany');
  assert.match(codes, /editForm\.note/, 'brak pola notatki');
});

test('interfejs tłumaczy różnicę między zrealizowanym a wydanym', () => {
  assert.match(codes, /Stripe/, 'brak wyjaśnienia skąd bierze się realizacja');
  assert.match(codes, /nie da się (tego )?(zmienić|kliknąć)/i, 'brak informacji, że realizacji nie da się zmienić');
});

test('warstwa API kodów istnieje i nie modyfikuje kodów w Stripe', () => {
  assert.match(api, /listCodes/, 'brak pobierania kodów');
  assert.match(api, /saveCodeNote/, 'brak zapisu notatki');
  assert.doesNotMatch(api, /deactivateCode|createCode|updateCoupon/, 'API nie powinno modyfikować kodów w Stripe');
});

// --- Grupa VIP: dodatkowe usługi i wpłaty (bez kwoty bazowej) ---

test('Grupa VIP ma wpłaty i usługi dodatkowe, ale nie ma kwoty całkowitej', () => {
  const form = read('components/PatientForm.tsx');

  // Kwota bazowa i termin zapłaty tylko dla pakietów innych niż VIP
  assert.match(form, /\{!isVip && \(/, 'kwota całkowita powinna być ukryta dla VIP');
  assert.match(form, /Kwota całkowita \(PLN\)/, 'brak pola kwoty całkowitej dla zwykłych pakietów');

  // Wpłaty i usługi NIE moga byc juz schowane w gałęzi else dla nie-VIP
  assert.doesNotMatch(form, /\{isVip \? \(/, 'VIP nie powinien podmieniać całej sekcji rozliczeń');
  assert.match(form, /Dodaj wpłatę/, 'brak dodawania wpłat');
  assert.match(form, /Dodaj usługę/, 'brak dodawania usług dodatkowych');
});

test('VIP bez dodatków nie udaje, że jest opłacony', () => {
  const form = read('components/PatientForm.tsx');
  assert.match(form, /Brak dodatkowych kosztów/, 'VIP bez usług i wpłat powinien pokazywać neutralny komunikat, nie "Opłacone w całości"');
});
