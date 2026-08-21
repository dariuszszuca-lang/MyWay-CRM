import type jsPDF from 'jspdf';
import { PACKAGE_LABELS, type Patient, type PatientPackage } from '../types.ts';
import { createPdf, loadFonts, addLogo } from './pdfBase.ts';

// Dokumenty wypisowe: dyplom, zaświadczenie o ukończeniu terapii, o pobycie, o uczestnictwie.
// Część „dane" (kwalifikacja, odmiana, daty, nazwy plików) jest czysta i testowana w tests/.
// Część „PDF" rysuje dokument na wspólnej bazie (pdfBase). Importy z rozszerzeniem .ts, żeby
// tools/podglad-dokumentow-wypisu.mjs mógł wyrenderować podgląd w Node bez przeglądarki.

export type DischargeDocumentKind = 'dyplom' | 'ukonczenie' | 'pobyt' | 'uczestnictwo';

export const DOCUMENT_LABELS: Record<DischargeDocumentKind, string> = {
  dyplom: 'Dyplom imienny',
  ukonczenie: 'Zaświadczenie o ukończeniu terapii',
  pobyt: 'Zaświadczenie o pobycie',
  uczestnictwo: 'Zaświadczenie o uczestnictwie w terapii',
};

const FILE_PREFIX: Record<DischargeDocumentKind, string> = {
  dyplom: 'dyplom',
  ukonczenie: 'zaswiadczenie-o-ukonczeniu-terapii',
  pobyt: 'zaswiadczenie-o-pobycie',
  uczestnictwo: 'zaswiadczenie-o-uczestnictwie-w-terapii',
};

// Minimalny wycinek pacjenta potrzebny do dokumentów (testy podają zwykłe obiekty)
export type DocumentPatient = Pick<Patient,
  'firstName' | 'lastName' | 'pesel' | 'package' | 'treatmentStartDate' | 'treatmentEndDate' | 'status' | 'dischargeType' | 'dischargeDate'>;

const ISSUER = {
  company: 'Bella Vita 3City Sp. z o.o.',
  brand: 'Ośrodek Leczenia Uzależnień MyWay',
  address: 'ul. Wichrowe Wzgórza 21, 84-200 Kąpino',
  nip: 'NIP 588-242-22-71',
  footer: 'MyWay Ośrodek Leczenia Uzależnień  ·  osrodek-myway.pl  ·  tel. 731 395 295',
};

const MONTHS_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export const formatDateLongPl = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS_GENITIVE[Number(m[2]) - 1]} ${m[1]}`;
};

// 10. cyfra PESEL: parzysta = kobieta, nieparzysta = mężczyzna
export const genderFromPesel = (pesel: string): 'm' | 'f' | null => {
  if (!/^\d{11}$/.test(pesel || '')) return null;
  return Number(pesel[9]) % 2 === 1 ? 'm' : 'f';
};

const isCompletedDischarge = (p: DocumentPatient): boolean => p.status === 'discharged' && p.dischargeType === 'completed';

export const availableDocuments = (p: DocumentPatient): DischargeDocumentKind[] =>
  isCompletedDischarge(p) ? ['dyplom', 'ukonczenie', 'pobyt', 'uczestnictwo'] : ['pobyt', 'uczestnictwo'];

export interface DocumentData {
  fullName: string;
  pesel: string;
  salutation: 'Pan' | 'Pani' | 'Pan/Pani';
  verbs: { stayed: string; participated: string; completed: string };
  stayFrom: string;
  stayTo: string;
  inProgress: boolean;
  plannedEnd: string;
  packageName: string;
  issuedOn: string;
}

export const buildDocumentData = (p: DocumentPatient, todayIso: string): DocumentData => {
  const gender = genderFromPesel(p.pesel);
  const inProgress = p.status !== 'discharged';
  const past = (m: string, f: string, both: string) => (gender === 'm' ? m : gender === 'f' ? f : both);
  return {
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    pesel: p.pesel,
    salutation: gender === 'm' ? 'Pan' : gender === 'f' ? 'Pani' : 'Pan/Pani',
    verbs: {
      stayed: inProgress ? 'przebywa' : past('przebywał', 'przebywała', 'przebywał(a)'),
      participated: inProgress ? 'uczestniczy' : past('uczestniczył', 'uczestniczyła', 'uczestniczył(a)'),
      completed: past('ukończył', 'ukończyła', 'ukończył(a)'),
    },
    stayFrom: formatDateLongPl(p.treatmentStartDate),
    stayTo: formatDateLongPl(inProgress ? todayIso : (p.dischargeDate || p.treatmentEndDate)),
    inProgress,
    plannedEnd: formatDateLongPl(p.treatmentEndDate),
    packageName: PACKAGE_LABELS[p.package as PatientPackage] || p.package,
    issuedOn: formatDateLongPl(todayIso),
  };
};

const slug = (text: string): string => text
  .replace(/[ąĄ]/g, 'a').replace(/[ćĆ]/g, 'c').replace(/[ęĘ]/g, 'e').replace(/[łŁ]/g, 'l').replace(/[ńŃ]/g, 'n')
  .replace(/[óÓ]/g, 'o').replace(/[śŚ]/g, 's').replace(/[źżŹŻ]/g, 'z')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const documentFileName = (kind: DischargeDocumentKind, p: Pick<DocumentPatient, 'firstName' | 'lastName'>): string =>
  `${FILE_PREFIX[kind]}-${slug(`${p.firstName} ${p.lastName}`)}.pdf`;

// ---------- PDF ----------

const NAVY: [number, number, number] = [27, 46, 90];   // #1B2E5A, brand MyWay
const TEAL: [number, number, number] = [42, 157, 143];  // #2A9D8F
const GRAY = 110;

const todayIso = () => new Date().toISOString().slice(0, 10);

// Zaświadczenie A4 pionowo: nagłówek wydawcy, tytuł, nazwisko, treść, podpis
const drawCertificate = async (title: string, subtitle: string, body: string[], d: DocumentData): Promise<jsPDF> => {
  const doc = createPdf();
  await loadFonts(doc);
  addLogo(doc);

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(GRAY);
  doc.text([ISSUER.company, ISSUER.brand, ISSUER.address, ISSUER.nip], 20, 14);
  doc.text(`Kąpino, dnia ${d.issuedOn}`, 190, 34, { align: 'right' });

  doc.setTextColor(...NAVY);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(20);
  doc.text(title, 105, 70, { align: 'center' });
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(GRAY);
  doc.text(subtitle, 105, 78, { align: 'center' });

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text('Zaświadcza się, że', 105, 98, { align: 'center' });
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(16);
  doc.text(`${d.salutation} ${d.fullName}`, 105, 108, { align: 'center' });
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(GRAY);
  doc.text(`PESEL ${d.pesel}`, 105, 115, { align: 'center' });

  doc.setTextColor(0);
  doc.setFontSize(12);
  let y = 130;
  for (const paragraph of body) {
    const lines = doc.splitTextToSize(paragraph, 160) as string[];
    doc.text(lines, 25, y);
    y += lines.length * 6.5 + 5;
  }

  doc.setFontSize(10);
  doc.setTextColor(GRAY);
  doc.text('Zaświadczenie wydaje się na prośbę osoby zainteresowanej, celem przedłożenia według potrzeb.', 25, y + 6, { maxWidth: 160 });

  doc.setDrawColor(120);
  doc.line(120, 232, 190, 232);
  doc.setFontSize(9);
  doc.text('podpis i pieczęć Ośrodka', 155, 237, { align: 'center' });

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(20, 278, 190, 278);
  doc.setFontSize(8);
  doc.text(ISSUER.footer, 105, 284, { align: 'center' });
  return doc;
};

// miejscownik: w Ośrodku, nie w Ośrodek
const stayPlace = `w Ośrodku Leczenia Uzależnień MyWay w Kąpinie (${ISSUER.address}), prowadzonym przez ${ISSUER.company}`;

const certificateBody = (kind: Exclude<DischargeDocumentKind, 'dyplom'>, d: DocumentData): string[] => {
  const period = `w okresie od ${d.stayFrom} do ${d.stayTo}`;
  switch (kind) {
    case 'pobyt':
      return [
        `${d.verbs.stayed} ${stayPlace}, ${period}.`,
        ...(d.inProgress ? [`Pobyt trwa nadal. Planowany termin zakończenia: ${d.plannedEnd}.`] : []),
      ];
    case 'uczestnictwo':
      return [
        `${d.verbs.participated} w programie terapii uzależnień (${d.packageName}) realizowanym ${stayPlace}, ${period}.`,
        ...(d.inProgress ? [`Terapia jest w toku. Planowany termin zakończenia: ${d.plannedEnd}.`] : []),
      ];
    case 'ukonczenie':
      return [`${d.verbs.completed} program terapii uzależnień (${d.packageName}) realizowany ${stayPlace}, ${period}.`];
  }
};

// Dyplom A4 poziomo, kierunek „MyWay granat": pasek granatowy z marką, nazwisko w teal, jedno zdanie, podpis
const drawDiploma = async (d: DocumentData): Promise<jsPDF> => {
  const doc = createPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadFonts(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 297, 40, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 40, 297, 2, 'F');
  doc.setTextColor(255);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(28);
  doc.text('MyWay', 22, 24);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(9);
  doc.text('OŚRODEK LECZENIA UZALEŻNIEŃ  ·  KĄPINO', 22, 32);

  doc.setTextColor(...NAVY);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(36);
  doc.text('DYPLOM', 148.5, 75, { align: 'center' });
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(GRAY);
  doc.text('ukończenia programu terapii', 148.5, 84, { align: 'center' });

  doc.setTextColor(...TEAL);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(30);
  doc.text(d.fullName, 148.5, 110, { align: 'center' });

  doc.setTextColor(0);
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(13);
  doc.text(`${d.verbs.completed} program terapii uzależnień w Ośrodku MyWay w Kąpinie`, 148.5, 126, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(GRAY);
  doc.text(`w okresie od ${d.stayFrom} do ${d.stayTo}`, 148.5, 135, { align: 'center' });

  doc.setTextColor(...NAVY);
  doc.setFontSize(12);
  doc.text('„Trzeźwość to nie koniec drogi. To jej początek.”', 148.5, 156, { align: 'center' });

  doc.setTextColor(GRAY);
  doc.setFontSize(10);
  doc.text(`Kąpino, ${d.issuedOn}`, 22, 186);
  doc.setDrawColor(120);
  doc.line(200, 184, 275, 184);
  doc.setFontSize(9);
  doc.text('podpis i pieczęć Ośrodka', 237.5, 189, { align: 'center' });

  doc.setFillColor(...NAVY);
  doc.rect(0, 204, 297, 6, 'F');
  return doc;
};

export const generateDischargeDocument = async (
  kind: DischargeDocumentKind,
  patient: DocumentPatient,
  options: { today?: string } = {},
): Promise<jsPDF> => {
  const d = buildDocumentData(patient, options.today || todayIso());
  if (kind === 'dyplom') return drawDiploma(d);
  const titles: Record<Exclude<DischargeDocumentKind, 'dyplom'>, string> = {
    ukonczenie: 'o ukończeniu terapii',
    pobyt: 'o pobycie w ośrodku',
    uczestnictwo: 'o uczestnictwie w terapii',
  };
  return drawCertificate('ZAŚWIADCZENIE', titles[kind], certificateBody(kind, d), d);
};
