// Dokumenty do umowy (specyfikacja zmian CRM 06.10.2026): potwierdzenie wpłaty oraz aneks
// (przedłużenie pobytu albo usługa dodatkowa). Dane wyłącznie z karty i historii rozliczeń.
import jsPDF from 'jspdf';
import { loadFonts } from './pdfBase';
import { CONTRACT_ISSUERS, ContractIssuerKey } from './issuer';
import {
  AdditionalService, Patient, Payment, PAYMENT_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, SERVICE_TYPE_LABELS,
  formatCurrency, getAdditionalServicesTotal,
} from '../types';

// ---------- kwota słownie ----------
const J = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const N = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const D = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const S = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
const odmiana = (n: number, f: [string, string, string]) => {
  if (n === 1) return f[0];
  const d = n % 10; const s = n % 100;
  return d >= 2 && d <= 4 && !(s >= 12 && s <= 14) ? f[1] : f[2];
};
const trojka = (n: number) => {
  const cz: string[] = [];
  if (S[Math.floor(n / 100)]) cz.push(S[Math.floor(n / 100)]);
  const r = n % 100;
  if (r >= 10 && r < 20) cz.push(N[r - 10]);
  else { if (D[Math.floor(r / 10)]) cz.push(D[Math.floor(r / 10)]); if (J[r % 10]) cz.push(J[r % 10]); }
  return cz.join(' ');
};
export function kwotaSlownie(kwota: number): string {
  const grosze = Math.round(Math.abs(kwota) * 100);
  const zl = Math.floor(grosze / 100); const gr = grosze % 100;
  const cz: string[] = [];
  const mln = Math.floor(zl / 1_000_000); const tys = Math.floor((zl % 1_000_000) / 1000); const reszta = zl % 1000;
  if (mln) cz.push(`${trojka(mln)} ${odmiana(mln, ['milion', 'miliony', 'milionów'])}`);
  if (tys) cz.push(`${tys === 1 ? '' : `${trojka(tys)} `}${odmiana(tys, ['tysiąc', 'tysiące', 'tysięcy'])}`);
  if (reszta || zl === 0) cz.push(zl === 0 ? 'zero' : trojka(reszta));
  return `${cz.join(' ').trim()} ${odmiana(zl, ['złoty', 'złote', 'złotych'])} ${String(gr).padStart(2, '0')}/100`;
}

// ---------- wspólne ----------
const dzis = () => new Date().toISOString().split('T')[0];
const issuerOf = (p: Patient) => CONTRACT_ISSUERS[(p.issuer || 'bella') as ContractIssuerKey];
const nazwaPliku = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_');

async function dokument(tytul: string, podtytul: string, patient: Patient) {
  const doc = new jsPDF();
  await loadFonts(doc);
  let y = 22;
  const linia = (text: string, bold = false, size = 10, align: 'left' | 'center' = 'left') => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const t = doc.splitTextToSize(text, 170);
    if (y + t.length * 5.5 > 280) { doc.addPage(); y = 22; }
    doc.text(t, align === 'center' ? 105 : 20, y, { align, maxWidth: 170 });
    y += t.length * 5.5;
  };
  const odstep = (n = 1) => { y += n * 5.5; };
  linia(tytul, true, 14, 'center');
  linia(podtytul, false, 10, 'center');
  odstep(1.5);
  linia(`Ośrodek: ${issuerOf(patient).party}.`);
  linia(`Zlecający: ${patient.firstName} ${patient.lastName}${patient.pesel ? `, PESEL: ${patient.pesel}` : ''}.`);
  odstep();
  const podpisy = (lewy: string, prawy: string) => {
    odstep(3);
    if (y > 255) { doc.addPage(); y = 40; }
    doc.setFont('Roboto', 'normal'); doc.setFontSize(9);
    doc.text('.............................................', 20, y); doc.text('.............................................', 120, y);
    doc.text(lewy, 20, y + 5); doc.text(prawy, 120, y + 5);
  };
  return { doc, linia, odstep, podpisy };
}

const rozliczenie = (p: Patient) => {
  const naleznosc = p.totalAmount + getAdditionalServicesTotal(p);
  const wplacono = (p.payments || []).filter((w) => !w.cancelled).reduce((s, w) => s + (w.amount || 0), 0);
  return { naleznosc, wplacono, saldo: Math.round((naleznosc - wplacono) * 100) / 100 };
};

export const tytulWplaty = (w: Payment) => w.purpose || (w.category ? PAYMENT_CATEGORY_LABELS[w.category] : (w.method === 'przedplata' ? 'Zadatek' : 'Płatność za terapię'));

// ---------- potwierdzenie wpłaty ----------
export async function generatePaymentConfirmation(patient: Patient, payment: Payment) {
  const nr = `P${payment.docNo ?? ''}/${patient.contractNumber}`;
  const { doc, linia, odstep, podpisy } = await dokument(`POTWIERDZENIE WPŁATY NR ${nr}`, `do Umowy o podjęcie terapii nr ${patient.contractNumber} z dnia ${patient.applicationDate}`, patient);
  linia(`Potwierdza się przyjęcie od Pani/Pana ${patient.firstName} ${patient.lastName} wpłaty w wysokości ${formatCurrency(payment.amount)} (słownie: ${kwotaSlownie(payment.amount)}) w dniu ${payment.date || dzis()}.`);
  odstep();
  linia(`Tytuł wpłaty: ${tytulWplaty(payment)}`, true);
  linia(`Forma płatności: ${PAYMENT_METHOD_LABELS[payment.method] || payment.method}`, true);
  odstep();
  const r = rozliczenie(patient);
  linia('Po zaksięgowaniu niniejszej wpłaty:');
  linia(`  •  łączna wartość należności: ${formatCurrency(r.naleznosc)};`);
  linia(`  •  łącznie wpłacono: ${formatCurrency(r.wplacono)};`);
  linia(`  •  pozostało do zapłaty: ${formatCurrency(Math.max(r.saldo, 0))};`);
  linia(`  •  termin zapłaty pozostałej kwoty: ${r.saldo > 0 ? (patient.paymentDeadline || '....................') : 'nie dotyczy'}.`);
  podpisy('Podpis osoby dokonującej wpłaty', 'Podpis osoby przyjmującej wpłatę');
  doc.save(`Potwierdzenie_wplaty_${nazwaPliku(nr)}_${patient.lastName}.pdf`);
}

// ---------- aneks ----------
export async function generateAnnex(patient: Patient, service: AdditionalService) {
  const nr = `A${service.docNo ?? ''}/${patient.contractNumber}`;
  const { doc, linia, odstep, podpisy } = await dokument(`ANEKS NR ${nr} DO UMOWY NR ${patient.contractNumber}`, `sporządzony w dniu ${dzis()}`, patient);
  const termin = service.paymentDeadline || '....................';
  const forma = service.paidMethod ? PAYMENT_METHOD_LABELS[service.paidMethod] : 'przelew / gotówka';
  if (service.type === 'przedluzenie') {
    const t = service.weeks;
    linia(`Strony uzgadniają przedłużenie pobytu o ${t ? `${t} ${t === 1 ? 'tydzień' : 'tygodnie'}` : '........ tydzień/tygodnie'}${service.extensionStart ? `, od dnia ${service.extensionStart}` : ''}.`);
    linia(`Nowy planowany termin zakończenia terapii: ${service.newEndDate || patient.treatmentEndDate}.`);
    linia(`Cena przedłużenia: ${formatCurrency(service.amount)} (słownie: ${kwotaSlownie(service.amount)}).`);
  } else {
    linia(`Zlecający zamawia usługę dodatkową: ${SERVICE_TYPE_LABELS[service.type] || service.type}${service.note ? ` (${service.note})` : ''}.`);
    linia(`Data realizacji lub planowanej realizacji: ${service.date}.`);
    linia(`Cena usługi: ${formatCurrency(service.amount)} (słownie: ${kwotaSlownie(service.amount)}).`);
  }
  linia(`Termin zapłaty: ${termin}.`);
  linia(`Forma płatności: ${forma}.`);
  odstep();
  linia('Pozostałe postanowienia umowy nie ulegają zmianie.');
  linia('Aneks sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.');
  podpisy('OŚRODEK', 'ZLECAJĄCY');
  doc.save(`Aneks_${nazwaPliku(nr)}_${patient.lastName}.pdf`);
}
