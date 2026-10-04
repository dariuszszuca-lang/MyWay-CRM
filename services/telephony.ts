// Telefonia przez API na AWS (gałąź aws). Te same nazwy funkcji i typy co wcześniej,
// żeby komponenty telefonii nie wymagały zmian. Poprzednia wersja na Firestore: telephony.firebase.ts.bak.
// Reguły (walidacje, okresy, podsumowania) dalej pochodzą z functions/telephony/core.mjs; serwer ma kopię 1:1.
import { api, BladApi, nasluchuj, zmieniono } from "./aws/api";
import { AWS_CONFIG } from "./aws/config";
export * from "../functions/telephony/core.mjs";

export interface PhoneContact {
  id: string;
  label: string;
  phone: string;
  firstDate: string;
  firstTime: string;
  category: string;
  quality: string;
  temperature: string;
  source: string;
  stage: string;
  province: string;
  status: string;
  closedDate: string;
  lossReason: string;
  nextDate: string;
  nextTime: string;
  followupStatus: string;
  note: string;
  followupNote: string;
  owner: string;
  revision: number;
  historical?: boolean;
  followupConfirmed?: boolean;
  historicalCount?: string;
  historicalDuration?: string;
  historicalFirstTime?: string;
  historicalClosedAt?: string;
  historicalFollowupAt?: string;
  historicalExtraNotes?: string;
  updatedBy?: string;
  updatedAt?: any;
  createdBy?: string;
  createdAt?: any;
}
export interface PhoneCall {
  id: string;
  contactId: string;
  date: string;
  time: string;
  kind: string;
  durationSeconds: number | null;
  result: string;
  answered: boolean;
  fullConversation: boolean;
  callback: boolean;
  note: string;
  createdBy?: string;
  createdAt?: any;
}
export interface PhoneFinancial {
  id: string;
  amount: number | null;
}
export interface PhoneReport {
  id: string;
  kind: string;
  from: string;
  to: string;
  summary: any;
  filters: Record<string, string>;
  generatedAt: string;
  automatic: boolean;
}
export type PhoneFilters = {
  source?: string;
  owner?: string;
  category?: string;
  quality?: string;
  kind?: string;
};
// Kolekcje Firestore -> ścieżki API. Nazwy zostają, bo używa ich TelefonyTab.
const SCIEZKI: Record<string, string> = {
  phoneContacts: "/telefonia/kontakty",
  phoneCalls: "/telefonia/rozmowy",
  phoneFinancials: "/telefonia/finanse",
  phoneReports: "/telefonia/raporty",
  phoneReportState: "/telefonia/stan-raportow",
  phoneImportSources: "/telefonia/zrodla",
};

// Zamiast nasłuchu Firestore: pobranie od razu, potem co 20 s i po każdym zapisie w telefonii.
export function watchPhoneCollection<T>(
  name: string,
  next: (v: T[]) => void,
  error: () => void,
) {
  const sciezka = SCIEZKI[name];
  if (!sciezka) {
    error();
    return () => {};
  }
  let zywe = true;
  const wczytaj = async () => {
    try {
      const r = await api("GET", sciezka);
      if (zywe) next((r.rows || []) as T[]);
    } catch {
      if (zywe) error();
    }
  };
  wczytaj();
  const odlacz = nasluchuj("telefonia", wczytaj);
  const zegar = window.setInterval(wczytaj, AWS_CONFIG.odswiezanieMs);
  return () => {
    zywe = false;
    odlacz();
    window.clearInterval(zegar);
  };
}

// Zapis kontaktu (+ rozmowa, + kwota): serwer robi to w jednej transakcji z historią zmian,
// według tych samych reguł co dotychczasowy savePhoneContactIn. Komunikaty błędów są te same.
export async function savePhoneContact(
  contact: PhoneContact,
  call: PhoneCall | null,
  amount: number | null | undefined,
) {
  try {
    const r = await api("POST", "/telefonia/kontakty", {
      contact,
      call,
      ...(amount !== undefined ? { amount } : {}),
    });
    zmieniono("telefonia");
    return r.id as string;
  } catch (e) {
    throw new Error(e instanceof BladApi ? e.message : "Nie udało się zapisać kontaktu.");
  }
}

export async function savePhoneReport(report: Omit<PhoneReport, "id">) {
  try {
    await api("POST", "/telefonia/raporty", report);
    zmieniono("telefonia");
  } catch (e) {
    throw new Error(e instanceof BladApi && e.status === 403 ? "Brak dostępu do raportów." : (e as Error).message);
  }
}

// Treść materiału źródłowego importu (pobierana dopiero przy kliknięciu „Pobierz”).
export async function pobierzTrescZrodla(id: string): Promise<{ format: string; content: string }> {
  return api("GET", `/telefonia/zrodla/${encodeURIComponent(id)}`);
}
