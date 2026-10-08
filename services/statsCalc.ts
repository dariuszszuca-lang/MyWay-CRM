// Średnia kwota na pacjenta liczona wyłącznie z wybranych pakietów.
// Przychód pacjenta = kwota pakietu + usługi dodatkowe, czyli ta sama definicja,
// której używa kafelek „Przychód" w statystykach (naprawa asymetrii z Etapu 0).
// Plik nie importuje nic w czasie wykonania, żeby test `node --test` czytał go bez bundlera.

export const DEFAULT_EXCLUDED_PACKAGES: string[] = ['vip', 'przyjazd_5tyg', 'powrot_przerwa'];

// Umowy wg spółki: karta liczy się do spółki zapisanej przy wydruku umowy.
// Karty bez zapisanej spółki (umowy sprzed 06.10.2026 albo jeszcze niewydrukowane) idą osobno, bez zgadywania.
export interface ContractsByIssuer {
  bella: number;
  myway: number;
  brak: number;
}

export const contractsByIssuer = (patients: { issuer?: string }[]): ContractsByIssuer => {
  const wynik: ContractsByIssuer = { bella: 0, myway: 0, brak: 0 };
  for (const p of patients) {
    if (p.issuer === 'bella' || p.issuer === 'myway') wynik[p.issuer] += 1;
    else wynik.brak += 1;
  }
  return wynik;
};

export interface AveragePerPatientInput {
  package: string;
  totalAmount: number;
  additionalServices?: { amount?: number }[];
}

export interface AveragePerPatient {
  count: number;
  revenue: number;
  average: number | null; // null = brak pacjentów w wybranych pakietach (nie NaN, nie 0)
}

export const averagePerPatient = (
  patients: AveragePerPatientInput[],
  includedPackages: Iterable<string>,
): AveragePerPatient => {
  const included = new Set(includedPackages);
  const selected = patients.filter(p => included.has(p.package));
  const revenue = selected.reduce((sum, p) => {
    const services = (p.additionalServices || []).reduce((s, svc) => s + (svc.amount || 0), 0);
    return sum + (p.totalAmount || 0) + services;
  }, 0);
  const count = selected.length;
  return { count, revenue, average: count > 0 ? revenue / count : null };
};
