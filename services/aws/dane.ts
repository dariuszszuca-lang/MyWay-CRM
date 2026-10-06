// Warstwa danych CRM na AWS: tłumaczy działania ekranu na wywołania API.
// Zastępuje bezpośrednie zapisy do Firestore z App.tsx.
import type { AdditionalService, Patient, Payment, QueuePatient } from '../../types';
import { api, BladApi, zmieniono } from './api';
import {
  kolejkaDoApi, kolejkaZApi, pacjentDoApi, pacjentZApi, STATUS_KOLEJKI_DO_API, tylkoZmienione, TYP_WYPISU_DO_API,
  uslugaDoApi, uslugaZApi, wplataDoApi, wplataZApi,
} from './mapowanie';

// Ostatnio pobrane wersje: punkt odniesienia do wyliczenia, co się zmieniło przy zapisie.
const wierszeListy = new Map<string, Patient>();
const pelneKarty = new Map<string, Patient>();
const wierszeKolejki = new Map<string, QueuePatient>();
const pelneKolejki = new Map<string, QueuePatient>();

// Ośrodek zalogowanej osoby (z odpowiedzi serwera). Ośrodki testowe mają wyłączone maile i integracje.
let osrodekBiezacy = '';
const OSRODKI_TESTOWE = ['testowy', 'testowy-2'];
export const integracjeWlaczone = () => osrodekBiezacy !== '' && !OSRODKI_TESTOWE.includes(osrodekBiezacy);

// Pola, których wiersz listy nie zawiera. Zapis z wiersza nigdy ich nie wysyła (inaczej wyczyściłby je na serwerze).
const TYLKO_W_KARCIE = ['adres', 'email', 'dowod', 'terminPlatnosci'];

const kopia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- pacjenci ----------
export async function pobierzPacjentow(): Promise<Patient[]> {
  const r = await api('GET', '/pacjenci');
  osrodekBiezacy = r.osrodek || '';
  const lista: Patient[] = (r.pacjenci || []).map((x: any) => pacjentZApi(x));
  wierszeListy.clear();
  lista.forEach((p) => wierszeListy.set(p.id, kopia(p)));
  return lista;
}

// Pełna karta: adres, e-mail, dowód, lista wpłat i usług. Serwer zapisuje to otwarcie w dzienniku dostępu.
export async function pobierzPelnego(id: string): Promise<Patient> {
  const [karta, finanse] = await Promise.all([api('GET', `/pacjenci/${id}`), api('GET', `/pacjenci/${id}/finanse`)]);
  const p = pacjentZApi(karta, true);
  // Numer kolejny wpisu na karcie (wg czasu zapisu, razem z anulowanymi): z niego powstaje numer potwierdzenia wpłaty i aneksu.
  const numeruj = (lista: any[]) => [...lista].sort((a, b) => String(a.utworzono || '').localeCompare(String(b.utworzono || ''))).map((w, i) => ({ ...w, docNo: i + 1 }));
  p.payments = numeruj(finanse.wplaty || []).filter((w: any) => !w.anulowano).map(wplataZApi).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  p.additionalServices = numeruj(finanse.uslugi || []).filter((u: any) => !u.anulowano).map(uslugaZApi).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  p.amountPaid = finanse.sumaWplat ?? 0;
  p.sumaUslug = finanse.sumaUslug ?? 0;
  pelneKarty.set(id, kopia(p));
  return p;
}

const tasama = (a: Payment, b: Payment) => a.amount === b.amount && (a.date || '') === (b.date || '') && a.method === b.method && (a.purpose || '') === (b.purpose || '') && (a.category || '') === (b.category || '');
const tasamaUsluga = (a: AdditionalService, b: AdditionalService) => a.type === b.type && a.amount === b.amount && (a.date || '') === (b.date || '') && (a.note || '') === (b.note || '')
  && (a.weeks || 0) === (b.weeks || 0) && (a.extensionStart || '') === (b.extensionStart || '') && (a.newEndDate || '') === (b.newEndDate || '') && (a.paymentDeadline || '') === (b.paymentDeadline || '')
  && (a.paidDate || '') === (b.paidDate || '') && (a.paidMethod || '') === (b.paidMethod || '') && (a.paymentStatus || '') === (b.paymentStatus || '');

// Różnica list wpłat albo usług: wpis usunięty albo zmieniony = storno starego, nowy albo zmieniony = dodanie.
async function zapiszFinanse(id: string, stare: Patient, nowe: Patient) {
  const sw = stare.payments || [];
  const nw = (nowe.payments || []).filter((w) => (w.amount || 0) > 0);
  for (const s of sw) {
    const n = nw.find((x) => x.id && x.id === s.id);
    if (!n || !tasama(s, n)) await api('DELETE', `/pacjenci/${id}/finanse/${s.id}`, { powod: n ? 'Zmiana wpłaty w karcie pacjenta' : 'Usunięcie wpłaty w karcie pacjenta' });
  }
  for (const n of nw) {
    const s = n.id ? sw.find((x) => x.id === n.id) : undefined;
    if (!s || !tasama(s, n)) await api('POST', `/pacjenci/${id}/wplaty`, wplataDoApi(n));
  }
  const su = stare.additionalServices || [];
  const nu = nowe.additionalServices || [];
  for (const s of su) {
    const n = nu.find((x) => x.id && x.id === s.id);
    if (!n || !tasamaUsluga(s, n)) await api('DELETE', `/pacjenci/${id}/finanse/${s.id}`, { powod: n ? 'Zmiana usługi w karcie pacjenta' : 'Usunięcie usługi w karcie pacjenta' });
  }
  for (const n of nu) {
    const s = n.id ? su.find((x) => x.id === n.id) : undefined;
    if (!s || !tasamaUsluga(s, n)) await api('POST', `/pacjenci/${id}/uslugi`, uslugaDoApi(n));
  }
}

// Nowy pacjent. Przy przyjęciu z kolejki serwer sam przenosi zaliczkę (jako wpłatę) i detoks (jako usługę)
// w jednej transakcji, więc pomijamy te dwa wpisy z formularza, żeby nie zapisać ich drugi raz.
export async function dodajPacjenta(p: Patient, zKolejki?: QueuePatient): Promise<string> {
  let id: string;
  let wplaty = (p.payments || []).filter((w) => (w.amount || 0) > 0);
  let uslugi = p.additionalServices || [];
  if (zKolejki) {
    const r = await api('POST', `/kolejka/${zKolejki.id}/przyjecie`, pacjentDoApi(p));
    id = r.pacjentId;
    if (zKolejki.depositAmount > 0) {
      const i = wplaty.findIndex((w) => w.method === 'przedplata' && w.amount === zKolejki.depositAmount);
      if (i >= 0) wplaty = wplaty.filter((_, j) => j !== i);
    }
    if (zKolejki.detoksPackage) {
      const i = uslugi.findIndex((u) => u.type === 'detoks');
      if (i >= 0) uslugi = uslugi.filter((_, j) => j !== i);
    }
  } else {
    id = (await api('POST', '/pacjenci', pacjentDoApi(p))).id;
  }
  for (const w of wplaty) await api('POST', `/pacjenci/${id}/wplaty`, wplataDoApi(w));
  for (const u of uslugi) await api('POST', `/pacjenci/${id}/uslugi`, uslugaDoApi(u));
  zmieniono('pacjenci', 'kolejka', 'pokoje');
  return id;
}

export interface WynikZapisu { przesunietePrzydzialy?: number; ostrzezenie?: string }

export async function zapiszPacjenta(nowy: Patient): Promise<WynikZapisu> {
  const pelny = Boolean(nowy.pelny);
  const stary = pelny ? pelneKarty.get(nowy.id) : wierszeListy.get(nowy.id);
  if (!stary) throw new BladApi(409, 'nieaktualne', 'Dane na ekranie są nieaktualne. Odśwież listę i spróbuj ponownie.');

  const zmiany = tylkoZmienione(pacjentDoApi(stary), pacjentDoApi(nowy));
  if (!pelny) TYLKO_W_KARCIE.forEach((k) => delete zmiany[k]);

  let wynik: WynikZapisu = {};
  if (Object.keys(zmiany).length > 0) {
    const r = await api('PUT', `/pacjenci/${nowy.id}`, { ...zmiany, wersja: stary.wersja });
    wynik = { przesunietePrzydzialy: r.przesunietePrzydzialy, ostrzezenie: r.ostrzezenie };
    stary.wersja = r.wersja;
  }
  if (pelny) await zapiszFinanse(nowy.id, stary, nowy);
  pelneKarty.delete(nowy.id);
  zmieniono('pacjenci', 'pokoje');
  return wynik;
}

// Zapis uwag z ochroną przed nadpisaniem cudzej zmiany (jak dotychczasowa transakcja w Firestore).
export async function zapiszNotatki(id: string, notatki: string, oryginalne: string): Promise<void> {
  const konflikt = 'Uwagi zostały zmienione przez inną osobę. Skopiuj swój tekst, zamknij panel i otwórz aktualne uwagi.';
  const wiersz = wierszeListy.get(id);
  if (!wiersz) throw new Error('Pacjent nie jest już dostępny.');
  if ((wiersz.notes || '') !== oryginalne) throw new Error(konflikt);
  try {
    await api('PUT', `/pacjenci/${id}`, { notatki, wersja: wiersz.wersja });
  } catch (e) {
    if (!(e instanceof BladApi) || e.status !== 409) throw e;
    // Karta zmieniła się od ostatniego odświeżenia listy: sprawdzamy, czy zmieniły się akurat uwagi.
    const swieza = (await pobierzPacjentow()).find((p) => p.id === id);
    if (!swieza) throw new Error('Pacjent nie jest już dostępny.');
    if ((swieza.notes || '') !== oryginalne) throw new Error(konflikt);
    await api('PUT', `/pacjenci/${id}`, { notatki, wersja: swieza.wersja });
  }
  zmieniono('pacjenci');
}

export async function usunPacjenta(id: string, powod: string): Promise<void> {
  const wiersz = wierszeListy.get(id);
  await api('DELETE', `/pacjenci/${id}`, { powod, wersja: wiersz?.wersja });
  zmieniono('pacjenci', 'pokoje');
}

export async function dodajWplate(id: string, wplata: Payment): Promise<void> {
  await api('POST', `/pacjenci/${id}/wplaty`, wplataDoApi(wplata));
  pelneKarty.delete(id);
  zmieniono('pacjenci');
}

export interface DaneWypisu {
  dischargeType: NonNullable<Patient['dischargeType']>;
  dischargeDate: string;
  refundAmount?: number;
  refundDate?: string;
  conditionalReturnDate?: string;
  dischargeNotes?: string;
  authorizedBy?: string;
  authorizedNote?: string;
}

const wypisDoApi = (d: DaneWypisu) => ({
  typWypisu: TYP_WYPISU_DO_API[d.dischargeType],
  dataWypisu: d.dischargeDate,
  ...(d.refundAmount ? { kwotaZwrotu: d.refundAmount } : {}),
  ...(d.refundDate ? { dataZwrotu: d.refundDate } : {}),
  ...(d.conditionalReturnDate ? { dataPowrotu: d.conditionalReturnDate } : {}),
  ...(d.dischargeNotes ? { uwagiWypisu: d.dischargeNotes } : {}),
  ...(d.authorizedBy ? { zgodaNaDlugZatwierdzil: d.authorizedBy } : {}),
  ...(d.authorizedNote ? { zgodaNaDlugNotatka: d.authorizedNote } : {}),
});

// Wypis: status, zwolnienie pokoju i dziennik zapisują się na serwerze w jednej transakcji.
export async function wypisz(id: string, d: DaneWypisu): Promise<{ zwolnionePrzydzialy: number; mimoZadluzenia: boolean }> {
  const r = await api('POST', `/pacjenci/${id}/wypis`, wypisDoApi(d));
  pelneKarty.delete(id);
  zmieniono('pacjenci', 'pokoje');
  return r;
}

export async function zmienWypis(id: string, d: DaneWypisu): Promise<void> {
  await api('PUT', `/pacjenci/${id}/wypis`, wypisDoApi({ ...d, authorizedBy: undefined, authorizedNote: undefined }));
  pelneKarty.delete(id);
  zmieniono('pacjenci');
}

export async function przywroc(id: string): Promise<void> {
  await api('POST', `/pacjenci/${id}/przywrocenie`);
  pelneKarty.delete(id);
  zmieniono('pacjenci');
}

// ---------- kolejka ----------
export async function pobierzKolejke(): Promise<QueuePatient[]> {
  const r = await api('GET', '/kolejka?widok=wszyscy');
  const lista: QueuePatient[] = (r.kolejka || []).filter((x: any) => x.status !== 'przyjety').map((x: any) => kolejkaZApi(x));
  wierszeKolejki.clear();
  lista.forEach((q) => wierszeKolejki.set(q.id, kopia(q)));
  return lista;
}

// Pełny wpis kolejki z PESEL, dowodem i adresem (otwarcie zapisuje się w dzienniku).
export async function pobierzKarteKolejki(id: string): Promise<QueuePatient> {
  const q = kolejkaZApi(await api('GET', `/kolejka/${id}`), true);
  pelneKolejki.set(id, kopia(q));
  return q;
}

export async function dodajDoKolejki(q: QueuePatient): Promise<string> {
  const r = await api('POST', '/kolejka', kolejkaDoApi(q));
  zmieniono('kolejka');
  return r.id;
}

export async function zapiszKolejke(nowy: QueuePatient): Promise<void> {
  // Wpis edytowany w formularzu jest pełny (z PESEL, dowodem i adresem): porównujemy go z pełnym oryginałem.
  const stary = nowy.pelny ? pelneKolejki.get(nowy.id) : wierszeKolejki.get(nowy.id);
  if (!stary) throw new BladApi(409, 'nieaktualne', 'Dane na ekranie są nieaktualne. Odśwież kolejkę i spróbuj ponownie.');
  const zmiany = tylkoZmienione(kolejkaDoApi(stary), kolejkaDoApi(nowy));
  if (nowy.status !== stary.status) zmiany.status = STATUS_KOLEJKI_DO_API[nowy.status];
  if (Object.keys(zmiany).length === 0) return;
  await api('PUT', `/kolejka/${nowy.id}`, { ...zmiany, wersja: stary.wersja });
  pelneKolejki.delete(nowy.id);
  zmieniono('kolejka');
}

export async function usunZKolejki(id: string, powod: string): Promise<void> {
  await api('DELETE', `/kolejka/${id}`, { powod });
  zmieniono('kolejka', 'pokoje');
}

// Przed wydrukiem umowy: zapisuje wybraną spółkę i nadaje numer umowy (MW/ROK/NR), jeśli karta go nie ma.
// Zwraca świeżą pełną kartę, z której drukuje się dokument.
export async function przygotujUmowe(id: string, spolka: 'bella' | 'myway'): Promise<Patient> {
  const p = await pobierzPelnego(id);
  if (p.issuer !== spolka) await api('PUT', `/pacjenci/${id}`, { spolka, wersja: p.wersja });
  if (!p.contractNumber) await api('POST', `/pacjenci/${id}/numer-umowy`);
  const swieza = await pobierzPelnego(id);
  zmieniono('pacjenci');
  return swieza;
}

// ---------- Psychiatra: wizyty i limit konsultacji z pakietu ----------
export interface WizytaPsychiatry {
  id: string; data: string; godzina?: string; uwagi?: string;
  status: 'zarejestrowana' | 'potwierdzona' | 'zrealizowana' | 'anulowana' | 'niezglosil';
  rozliczenie: 'pakiet' | 'platna'; zrodlo?: 'recznie' | 'arkusz';
  historia?: { czas: string; konto: string; zmiana: string }[];
}
export interface PodsumowaniePsychiatry { limit: number; zarezerwowane: number; zrealizowane: number; pozostalo: number; platne: number }

export async function pobierzWizyty(id: string): Promise<{ wizyty: WizytaPsychiatry[]; psychiatra: PodsumowaniePsychiatry }> {
  const f = await api('GET', `/pacjenci/${id}/finanse`);
  return { wizyty: f.wizyty || [], psychiatra: f.psychiatra };
}

export async function dodajWizyte(id: string, w: { data: string; godzina?: string; uwagi?: string }): Promise<{ id: string; rozliczenie: 'pakiet' | 'platna' }> {
  const r = await api('POST', `/pacjenci/${id}/wizyty`, { data: w.data, ...(w.godzina ? { godzina: w.godzina } : {}), ...(w.uwagi ? { uwagi: w.uwagi } : {}) });
  pelneKarty.delete(id);
  zmieniono('pacjenci');
  return r;
}

export async function zmienWizyte(id: string, wizytaId: string, zmiana: { status?: WizytaPsychiatry['status']; data?: string; godzina?: string; uwagi?: string }): Promise<{ przeniesionaDoPakietu?: string }> {
  const r = await api('PUT', `/pacjenci/${id}/wizyty/${wizytaId}`, zmiana);
  pelneKarty.delete(id);
  zmieniono('pacjenci');
  return r;
}
