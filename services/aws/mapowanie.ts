// Mapowanie między polami API (po polsku) a typami ekranu (types.ts). Jedyne miejsce, które zna oba nazewnictwa.
import type { AdditionalService, Patient, Payment, QueuePatient, Room, RoomAssignment } from '../../types';

const TYP_WYPISU_Z_API: Record<string, NonNullable<Patient['dischargeType']>> = {
  zakonczenie: 'completed', rezygnacja: 'resignation', skierowanie: 'referral', przerwa: 'conditional_break', wydalenie: 'expelled',
};
export const TYP_WYPISU_DO_API: Record<string, string> = Object.fromEntries(Object.entries(TYP_WYPISU_Z_API).map(([k, v]) => [v, k]));

const STATUS_KOLEJKI_Z_API: Record<string, QueuePatient['status']> = { czeka: 'waiting', potwierdzony: 'confirmed', anulowany: 'cancelled', niestawil: 'noshow' };
export const STATUS_KOLEJKI_DO_API: Record<string, string> = Object.fromEntries(Object.entries(STATUS_KOLEJKI_Z_API).map(([k, v]) => [v, k]));

const DETOKS_Z_API: Record<string, NonNullable<QueuePatient['detoksPackage']>> = { '1dzien': '1day', '3dni': '3days' };
const DETOKS_DO_API: Record<string, string> = { '1day': '1dzien', '3days': '3dni' };

const dzis = () => new Date().toISOString().slice(0, 10);

// ---------- pacjent ----------
// Wiersz listy albo karta z API -> Patient. Pola, których nie ma w wierszu listy (adres, e-mail, dowód), są puste.
export function pacjentZApi(r: any, pelny = false): Patient {
  return {
    id: r.id,
    firstName: r.imie || '',
    lastName: r.nazwisko || '',
    pesel: r.pesel || '',
    birthDate: r.dataUrodzenia || '',
    idSeries: r.dowod || '',
    address: r.adres || '',
    voivodeship: r.wojewodztwo || '',
    phone: r.telefon || '',
    email: r.email || '',
    applicationDate: r.dataZgloszenia || '',
    treatmentStartDate: r.terapiaOd || '',
    treatmentEndDate: r.terapiaDo || '',
    package: r.pakiet,
    totalAmount: r.kwotaPakietu ?? 0,
    amountPaid: r.sumaWplat ?? 0,
    paymentDeadline: r.terminPlatnosci || '',
    paymentMethod: r.metodaPlatnosci || 'przelew',
    isWeek5: Boolean(r.tydzien5),
    hasWhatsapp: Boolean(r.whatsapp),
    onlineConsultations: r.konsultacjeOnline ?? 0,
    notes: r.notatki || '',
    contractNumber: r.nrUmowy || '',
    psychInPackage: r.psychPakiet ?? 0,
    psychDone: r.psychZreal ?? 0,
    psychPaid: r.psychPlatne ?? 0,
    issuer: r.spolka || undefined,
    status: r.status === 'wypisany' ? 'discharged' : 'active',
    dischargeType: r.typWypisu ? TYP_WYPISU_Z_API[r.typWypisu] : undefined,
    dischargeDate: r.dataWypisu || undefined,
    refundAmount: r.kwotaZwrotu ?? undefined,
    refundDate: r.dataZwrotu || undefined,
    conditionalReturnDate: r.dataPowrotu || undefined,
    dischargeNotes: r.uwagiWypisu || undefined,
    dischargeAuthorizedBy: r.zgodaNaDlugZatwierdzil || undefined,
    dischargeAuthorizedNote: r.zgodaNaDlugNotatka || undefined,
    wersja: r.wersja,
    pelny,
    sumaUslug: r.sumaUslug ?? 0,
    // Wiersz listy: zamiast listy usług serwer daje liczbę i kwotę wg rodzaju. Odtwarzamy z nich wpisy
    // (pierwszy z pełną kwotą, kolejne po 0), żeby statystyki liczyły sztuki i kwoty jak dotąd.
    // Pełna karta nadpisuje to prawdziwą listą usług (dane.ts pobierzPelnego).
    additionalServices: pelny ? undefined : uslugiZLicznikow(r.uslugiWgRodzaju),
  };
}

function uslugiZLicznikow(wg: Record<string, { ile: number; kwota: number }> | undefined): AdditionalService[] {
  const out: AdditionalService[] = [];
  for (const [typ, l] of Object.entries(wg || {})) {
    for (let i = 0; i < l.ile; i += 1) out.push({ type: typ as AdditionalService['type'], date: '', amount: i === 0 ? l.kwota : 0 });
  }
  return out;
}

export const wplataZApi = (w: any): Payment => ({ id: w.id, cancelled: Boolean(w.anulowano), amount: w.kwota, date: w.data, method: w.metoda, purpose: w.cel || undefined, category: w.kategoria || undefined, docNo: w.docNo });
export const uslugaZApi = (u: any): AdditionalService => ({
  id: u.id, cancelled: Boolean(u.anulowano), type: u.typ, date: u.data, amount: u.kwota, note: u.notatka || undefined,
  weeks: u.tygodnie, extensionStart: u.poczatekPrzedluzenia || undefined, newEndDate: u.nowyKoniec || undefined, paymentDeadline: u.terminPlatnosci || undefined,
  paidDate: u.dataWplaty || undefined, paidMethod: u.formaWplaty || undefined, paymentStatus: u.statusPlatnosci || undefined, docNo: u.docNo,
});

export const wplataDoApi = (w: Payment) => ({ kwota: w.amount, data: w.date || dzis(), metoda: w.method || 'przelew', ...(w.purpose ? { cel: w.purpose } : {}), ...(w.category ? { kategoria: w.category } : {}) });
export const uslugaDoApi = (u: AdditionalService) => ({
  typ: u.type, data: u.date || dzis(), kwota: u.amount || 0, ...(u.note ? { notatka: u.note } : {}),
  ...(u.type === 'przedluzenie' && u.weeks ? { tygodnie: Number(u.weeks) } : {}),
  ...(u.type === 'przedluzenie' && u.extensionStart ? { poczatekPrzedluzenia: u.extensionStart } : {}),
  ...(u.type === 'przedluzenie' && u.newEndDate ? { nowyKoniec: u.newEndDate } : {}),
  ...(u.paymentDeadline ? { terminPlatnosci: u.paymentDeadline } : {}), ...(u.paidDate ? { dataWplaty: u.paidDate } : {}),
  ...(u.paidMethod ? { formaWplaty: u.paidMethod } : {}), ...(u.paymentStatus ? { statusPlatnosci: u.paymentStatus } : {}),
});

// Pola karty, które przyjmuje API (bez wpłat, usług, statusu i wypisu: te mają własne operacje).
export function pacjentDoApi(p: Patient): Record<string, unknown> {
  return {
    imie: p.firstName,
    nazwisko: p.lastName,
    pesel: p.pesel || '',
    dowod: p.idSeries || '',
    dataUrodzenia: p.birthDate || '',
    adres: p.address || '',
    wojewodztwo: p.voivodeship || '',
    telefon: p.phone || '',
    email: p.email || '',
    dataZgloszenia: p.applicationDate || '',
    terapiaOd: p.treatmentStartDate || '',
    terapiaDo: p.treatmentEndDate || '',
    pakiet: p.package,
    kwotaPakietu: Number(p.totalAmount) || 0,
    terminPlatnosci: p.paymentDeadline || '',
    metodaPlatnosci: p.paymentMethod || 'przelew',
    whatsapp: Boolean(p.hasWhatsapp),
    tydzien5: Boolean(p.isWeek5),
    konsultacjeOnline: Number(p.onlineConsultations) || 0,
    notatki: p.notes || '',
    nrUmowy: p.contractNumber || '',
    ...(p.issuer ? { spolka: p.issuer } : {}),
  };
}

// ---------- kolejka ----------
export function kolejkaZApi(r: any, pelny = false): QueuePatient {
  return {
    id: r.id,
    firstName: r.imie || '',
    lastName: r.nazwisko || '',
    phone: r.telefon || '',
    email: r.email || '',
    pesel: r.pesel || undefined,
    birthDate: r.dataUrodzenia || undefined,
    idSeries: r.dowod || undefined,
    address: r.adres || undefined,
    voivodeship: r.wojewodztwo || undefined,
    package: r.pakiet,
    depositAmount: r.zaliczka ?? 0,
    depositDate: r.dataZaliczki || '',
    plannedStartDate: r.planowanyOd || '',
    plannedEndDate: r.planowanyDo || '',
    plannedArrivalTime: r.godzinaPrzyjazdu || undefined,
    notes: r.notatki || '',
    detoksPackage: r.detoks ? DETOKS_Z_API[r.detoks] : undefined,
    linkedPatientId: r.powiazanyPacjentId || undefined,
    createdAt: r.utworzono || '',
    status: STATUS_KOLEJKI_Z_API[r.status] || 'waiting',
    wersja: r.wersja,
    pelny,
  };
}

export function kolejkaDoApi(q: QueuePatient): Record<string, unknown> {
  return {
    imie: q.firstName,
    nazwisko: q.lastName,
    telefon: q.phone || '',
    email: q.email || '',
    pesel: q.pesel || '',
    dowod: q.idSeries || '',
    dataUrodzenia: q.birthDate || '',
    adres: q.address || '',
    wojewodztwo: q.voivodeship || '',
    pakiet: q.package,
    zaliczka: Number(q.depositAmount) || 0,
    dataZaliczki: q.depositDate || '',
    planowanyOd: q.plannedStartDate || '',
    planowanyDo: q.plannedEndDate || '',
    godzinaPrzyjazdu: q.plannedArrivalTime || '',
    notatki: q.notes || '',
    detoks: q.detoksPackage ? DETOKS_DO_API[q.detoksPackage] : '',
    powiazanyPacjentId: q.linkedPatientId || '',
  };
}

// ---------- pokoje ----------
export const pokojZApi = (r: any): Room => ({
  id: r.id,
  number: r.numer,
  capacity: r.miejsca,
  notes: r.notatki || undefined,
  isDisabled: Boolean(r.wylaczony),
  disabledReason: r.powodWylaczenia || undefined,
  disabledFrom: r.wylaczonyOd || undefined,
  disabledTo: r.wylaczonyDo || undefined,
  order: r.kolejnosc,
  wersja: r.wersja,
});

export function pokojDoApi(r: Partial<Omit<Room, 'id'>>): Record<string, unknown> {
  const w: Record<string, unknown> = {};
  if (r.number !== undefined) w.numer = r.number;
  if (r.capacity !== undefined) w.miejsca = r.capacity;
  if (r.notes !== undefined) w.notatki = r.notes || '';
  if (r.isDisabled !== undefined) w.wylaczony = r.isDisabled;
  if (r.disabledReason !== undefined) w.powodWylaczenia = r.disabledReason || '';
  if (r.disabledFrom !== undefined) w.wylaczonyOd = r.disabledFrom || '';
  if (r.disabledTo !== undefined) w.wylaczonyDo = r.disabledTo || '';
  if (r.order !== undefined) w.kolejnosc = r.order;
  return w;
}

export const przydzialZApi = (a: any): RoomAssignment => ({
  id: a.id,
  patientId: a.pacjentId || '',
  roomId: a.pokojId,
  fromDate: a.odDaty,
  toDate: a.doDaty || null,
  notes: a.notatki || undefined,
  createdAt: a.utworzono || '',
  queuePatientId: a.kolejkaId || undefined,
});

// Porównanie dwóch obiektów pól API: zwraca tylko pola, które się zmieniły.
export function tylkoZmienione(stare: Record<string, unknown>, nowe: Record<string, unknown>): Record<string, unknown> {
  const w: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nowe)) if (stare[k] !== v) w[k] = v;
  return w;
}
