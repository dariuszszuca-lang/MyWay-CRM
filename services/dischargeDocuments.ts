import type jsPDF from 'jspdf';
import { PACKAGE_LABELS, type Patient, type PatientPackage } from '../types.ts';
import { createPdf, fetchAsset, registerFont, textCenteredSpaced, type AssetLoader } from './pdfBase.ts';
import { ISSUER } from './issuer.ts';

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

export interface DocumentAssets {
  background: string;
  logo: string;
  fonts: { cormorantRegular: string; cormorantBold: string; montserratRegular: string; montserratBold: string };
}

export const requiredAssets = (kind: DischargeDocumentKind): DocumentAssets => ({
  background: kind === 'dyplom' ? '/dokumenty/tlo-dyplom.jpg' : '/dokumenty/tlo-zaswiadczenie.jpg',
  logo: '/dokumenty/logo-myway.png',
  fonts: {
    cormorantRegular: '/dokumenty/fonts/CormorantGaramond-Medium.ttf',
    cormorantBold: '/dokumenty/fonts/CormorantGaramond-SemiBold.ttf',
    montserratRegular: '/dokumenty/fonts/Montserrat-Regular.ttf',
    montserratBold: '/dokumenty/fonts/Montserrat-SemiBold.ttf',
  },
});

const NAVY: [number, number, number] = [27, 46, 90];    // #1B2E5A
const TEAL: [number, number, number] = [42, 157, 143];   // #2A9D8F
const INK: [number, number, number] = [38, 44, 58];
const MUTED: [number, number, number] = [112, 118, 130];
const LOGO_RATIO = 345 / 1196; // proporcje logo poziomego

const todayIso = () => new Date().toISOString().slice(0, 10);

type Prepared = { doc: jsPDF; logo: Uint8Array; w: number; h: number };

const prepare = async (kind: DischargeDocumentKind, loadAsset: AssetLoader): Promise<Prepared> => {
  const assets = requiredAssets(kind);
  const landscape = kind === 'dyplom';
  const doc = createPdf({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const [background, logo] = await Promise.all([
    loadAsset(assets.background),
    loadAsset(assets.logo),
    registerFont(doc, loadAsset, assets.fonts.cormorantRegular, 'Cormorant', 'normal'),
    registerFont(doc, loadAsset, assets.fonts.cormorantBold, 'Cormorant', 'bold'),
    registerFont(doc, loadAsset, assets.fonts.montserratRegular, 'Montserrat', 'normal'),
    registerFont(doc, loadAsset, assets.fonts.montserratBold, 'Montserrat', 'bold'),
  ]);
  const w = landscape ? 297 : 210;
  const h = landscape ? 210 : 297;
  doc.addImage(new Uint8Array(background), 'JPEG', 0, 0, w, h);
  return { doc, logo: new Uint8Array(logo), w, h };
};

const font = (doc: jsPDF, family: 'Cormorant' | 'Montserrat', style: 'normal' | 'bold', size: number, color: [number, number, number]) => {
  doc.setFont(family, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

const signature = (doc: jsPDF, x1: number, x2: number, y: number) => {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
  font(doc, 'Montserrat', 'normal', 8, MUTED);
  doc.text('podpis i pieczęć Ośrodka', (x1 + x2) / 2, y + 5, { align: 'center' });
};

// Zaświadczenie A4 pionowo
const drawCertificate = async (kind: Exclude<DischargeDocumentKind, 'dyplom'>, subtitle: string, body: string[], d: DocumentData, loadAsset: AssetLoader): Promise<jsPDF> => {
  const { doc, logo } = await prepare(kind, loadAsset);
  const logoW = 46;
  doc.addImage(logo, 'PNG', 110 - logoW / 2, 16, logoW, logoW * LOGO_RATIO);
  font(doc, 'Montserrat', 'bold', 8, NAVY);
  textCenteredSpaced(doc, ISSUER.name.toUpperCase(), 110, 38, 1.2);

  font(doc, 'Cormorant', 'bold', 34, NAVY);
  textCenteredSpaced(doc, 'ZAŚWIADCZENIE', 105, 78, 2);
  font(doc, 'Montserrat', 'bold', 9.5, TEAL);
  textCenteredSpaced(doc, subtitle.toUpperCase(), 105, 87, 2.5);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(90, 93, 120, 93);

  font(doc, 'Cormorant', 'normal', 14, MUTED);
  doc.text('Zaświadcza się, że', 105, 108, { align: 'center' });
  font(doc, 'Cormorant', 'bold', 24, NAVY);
  doc.text(`${d.salutation} ${d.fullName}`, 105, 120, { align: 'center' });
  font(doc, 'Montserrat', 'normal', 9, MUTED);
  doc.text(`PESEL ${d.pesel}`, 105, 127, { align: 'center' });

  font(doc, 'Cormorant', 'normal', 13.5, INK);
  let y = 142;
  for (const paragraph of body) {
    const lines = doc.splitTextToSize(paragraph, 150) as string[];
    doc.text(lines, 30, y, { lineHeightFactor: 1.35 });
    y += lines.length * 13.5 * 0.3528 * 1.35 + 5;
  }
  font(doc, 'Montserrat', 'normal', 8.5, MUTED);
  doc.text('Zaświadczenie wydaje się na prośbę osoby zainteresowanej, celem przedłożenia według potrzeb.', 30, y + 6, { maxWidth: 150 });

  font(doc, 'Montserrat', 'normal', 9, MUTED);
  doc.text(`Kąpino, dnia ${d.issuedOn}`, 180, 221, { align: 'right' });
  signature(doc, 112, 180, 232);

  font(doc, 'Montserrat', 'normal', 8, MUTED);
  doc.text(`${ISSUER.name}  ·  NIP ${ISSUER.nip}  ·  ${ISSUER.address}`, 105, 258, { align: 'center' });
  doc.text(ISSUER.contact, 105, 263, { align: 'center' });
  return doc;
};

const stayPlace = `w Ośrodku Leczenia Uzależnień MyWay w Kąpinie (${ISSUER.address}), prowadzonym przez ${ISSUER.name}`;

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

// Dyplom A4 poziomo: tło premium, logo na górze, nazwisko jako bohater, cytat MyWay, podpis
const drawDiploma = async (d: DocumentData, loadAsset: AssetLoader): Promise<jsPDF> => {
  const { doc, logo } = await prepare('dyplom', loadAsset);
  const logoW = 58;
  doc.addImage(logo, 'PNG', 148.5 - logoW / 2, 16, logoW, logoW * LOGO_RATIO);
  font(doc, 'Montserrat', 'bold', 8, NAVY);
  textCenteredSpaced(doc, ISSUER.name.toUpperCase(), 148.5, 41, 1.2);
  font(doc, 'Montserrat', 'normal', 8, MUTED);
  doc.text(`${ISSUER.address}  ·  NIP ${ISSUER.nip}`, 148.5, 46, { align: 'center' });

  font(doc, 'Cormorant', 'bold', 52, NAVY);
  textCenteredSpaced(doc, 'DYPLOM', 148.5, 72, 4);
  font(doc, 'Montserrat', 'bold', 10, TEAL);
  textCenteredSpaced(doc, 'UKOŃCZENIA PROGRAMU TERAPII', 148.5, 82, 3);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(128.5, 88, 168.5, 88);

  font(doc, 'Cormorant', 'bold', 40, TEAL);
  doc.text(d.fullName, 148.5, 110, { align: 'center' });
  font(doc, 'Cormorant', 'normal', 16, INK);
  doc.text(`${d.verbs.completed} program terapii uzależnień w Ośrodku MyWay w Kąpinie`, 148.5, 124, { align: 'center' });
  font(doc, 'Montserrat', 'normal', 10.5, MUTED);
  doc.text(`w okresie od ${d.stayFrom} do ${d.stayTo}`, 148.5, 133, { align: 'center' });

  font(doc, 'Cormorant', 'normal', 15, NAVY);
  doc.text('„Trzeźwość to nie koniec drogi. To jej początek.”', 148.5, 152, { align: 'center' });

  // dolny pas tła to mglisty las: data na środku nad mgłą, podpis po prawej, nic w lewym dolnym rogu
  font(doc, 'Montserrat', 'normal', 9.5, INK);
  doc.text(`Kąpino, ${d.issuedOn}`, 148.5, 167, { align: 'center' });
  signature(doc, 150, 218, 183);
  return doc;
};

export const generateDischargeDocument = async (
  kind: DischargeDocumentKind,
  patient: DocumentPatient,
  options: { today?: string; loadAsset?: AssetLoader } = {},
): Promise<jsPDF> => {
  const d = buildDocumentData(patient, options.today || todayIso());
  const loadAsset = options.loadAsset || fetchAsset;
  if (kind === 'dyplom') return drawDiploma(d, loadAsset);
  const subtitles: Record<Exclude<DischargeDocumentKind, 'dyplom'>, string> = {
    ukonczenie: 'o ukończeniu terapii',
    pobyt: 'o pobycie w ośrodku',
    uczestnictwo: 'o uczestnictwie w terapii',
  };
  return drawCertificate(kind, subtitles[kind], certificateBody(kind, d), d, loadAsset);
};
