// Klient API CRM. Każde zapytanie niesie token z logowania; serwer sam ustala ośrodek z konta.
import { AWS_CONFIG } from './config';
import { sesja, wyloguj } from './auth';

export class BladApi extends Error {
  status: number;
  kod: string;
  constructor(status: number, kod: string, wiadomosc: string) {
    super(wiadomosc);
    this.status = status;
    this.kod = kod;
  }
}

let poWygasnieciu: (() => void) | null = null;
export const ustawObslugeWygasniecia = (fn: () => void) => { poWygasnieciu = fn; };

export async function api<T = any>(metoda: 'GET' | 'POST' | 'PUT' | 'DELETE', sciezka: string, cialo?: unknown): Promise<T> {
  const s = await sesja();
  if (!s) {
    poWygasnieciu?.();
    throw new BladApi(401, 'brak-logowania', 'Sesja wygasła. Zaloguj się ponownie.');
  }
  let odp: Response;
  try {
    odp = await fetch(`${AWS_CONFIG.apiUrl}${sciezka}`, {
      method: metoda,
      headers: { authorization: `Bearer ${s.token}`, ...(cialo !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: cialo !== undefined ? JSON.stringify(cialo) : undefined,
    });
  } catch {
    throw new BladApi(0, 'brak-polaczenia', 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
  }
  const tekst = await odp.text();
  let dane: any = {};
  try { dane = tekst ? JSON.parse(tekst) : {}; } catch { /* odpowiedź bez JSON */ }
  if (odp.status === 401) {
    wyloguj();
    poWygasnieciu?.();
    throw new BladApi(401, 'brak-logowania', 'Sesja wygasła. Zaloguj się ponownie.');
  }
  if (!odp.ok) throw new BladApi(odp.status, dane.blad || 'blad', dane.wiadomosc || dane.message || `Błąd serwera (${odp.status}).`);
  return dane as T;
}

// Powiadamianie widoków o zmianie danych (zamiast nasłuchu na żywo z Firestore).
type Temat = 'pacjenci' | 'kolejka' | 'pokoje';
const sluchacze: Record<Temat, Set<() => void>> = { pacjenci: new Set(), kolejka: new Set(), pokoje: new Set() };
export const zmieniono = (...tematy: Temat[]) => tematy.forEach((t) => sluchacze[t].forEach((fn) => fn()));
export const nasluchuj = (temat: Temat, fn: () => void) => { sluchacze[temat].add(fn); return () => { sluchacze[temat].delete(fn); }; };
