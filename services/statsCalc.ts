// Średnia kwota na pacjenta liczona wyłącznie z wybranych pakietów.
// Przychód pacjenta = kwota pakietu + usługi dodatkowe, czyli ta sama definicja,
// której używa kafelek „Przychód" w statystykach (naprawa asymetrii z Etapu 0).
// Plik nie importuje nic w czasie wykonania, żeby test `node --test` czytał go bez bundlera.

export const DEFAULT_EXCLUDED_PACKAGES: string[] = ['vip'];

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
