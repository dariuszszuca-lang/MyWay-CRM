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

// Data urodzenia z PESEL: miesiąc 01-12 = 1900, 21-32 = 2000, 41-52 = 2100, 61-72 = 2200, 81-92 = 1800
export const birthDateFromPesel = (pesel: string): string | null => {
  if (!/^\d{11}$/.test(pesel || '')) return null;
  const yy = Number(pesel.slice(0, 2));
  const mmRaw = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));
  const centuries: Array<[number, number]> = [[1, 1900], [21, 2000], [41, 2100], [61, 2200], [81, 1800]];
  for (const [offset, century] of centuries) {
    const mm = mmRaw - (offset - 1);
    if (mm >= 1 && mm <= 12) {
      return `${century + yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  return null;
};

const isCompletedDischarge = (p: DocumentPatient): boolean => p.status === 'discharged' && p.dischargeType === 'completed';

export const availableDocuments = (p: DocumentPatient): DischargeDocumentKind[] =>
  isCompletedDischarge(p) ? ['dyplom', 'ukonczenie', 'pobyt', 'uczestnictwo'] : ['pobyt', 'uczestnictwo'];

export interface DocumentData {
  fullName: string;
  firstName: string;
  pesel: string;
  birthDate: string;
  salutation: 'Pan' | 'Pani' | 'Pan/Pani';
  verbs: { stayed: string; participated: string; completed: string; agreed: string; changed: string; discerned: string };
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
  const birthIso = birthDateFromPesel(p.pesel);
  return {
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    firstName: p.firstName.trim(),
    pesel: p.pesel,
    birthDate: birthIso ? formatDateLongPl(birthIso) : '',
    salutation: gender === 'm' ? 'Pan' : gender === 'f' ? 'Pani' : 'Pan/Pani',
    verbs: {
      stayed: inProgress ? 'przebywa' : past('przebywał', 'przebywała', 'przebywał(a)'),
      participated: inProgress ? 'uczestniczy' : past('uczestniczył', 'uczestniczyła', 'uczestniczył(a)'),
      completed: past('ukończył', 'ukończyła', 'ukończył(a)'),
      agreed: past('godził', 'godziła', 'godził(a)'),
      changed: past('zmieniał', 'zmieniała', 'zmieniał(a)'),
      discerned: past('odróżniał', 'odróżniała', 'odróżniał(a)'),
    },
    stayFrom: formatDateLongPl(p.treatmentStartDate),
    // W trakcie pobytu zakres „od-do" pokazuje CAŁY planowany pobyt (zgłoszenie Marcina 03.09.2026),
    // nie dzień wystawienia. Po wypisie: faktyczna data wypisu.
    stayTo: formatDateLongPl(inProgress ? p.treatmentEndDate : (p.dischargeDate || p.treatmentEndDate)),
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
  doc.text('Zaświadcza się, że', 105, 106, { align: 'center' });
  font(doc, 'Cormorant', 'bold', 24, NAVY);
  doc.text(`${d.salutation} ${d.fullName}`, 105, 117, { align: 'center' });
  font(doc, 'Montserrat', 'normal', 9, MUTED);
  const idLine = d.birthDate ? `ur. ${d.birthDate} r.  ·  PESEL ${d.pesel}` : `PESEL ${d.pesel}`;
  doc.text(idLine, 105, 124, { align: 'center' });

  // dłuższe treści (program + kontynuacja) dostają mniejszy stopień pisma, żeby zmieścić się nad stopką
  const long = body.length > 2;
  const bodySize = long ? 12 : 13.5;
  const gap = long ? 3 : 5;
  font(doc, 'Cormorant', 'normal', bodySize, INK);
  let y = long ? 134 : 140;
  for (const paragraph of body) {
    const lines = doc.splitTextToSize(paragraph, 150) as string[];
    doc.text(lines, 30, y, { lineHeightFactor: 1.3 });
    y += lines.length * bodySize * 0.3528 * 1.3 + gap;
  }
  font(doc, 'Montserrat', 'normal', 8.5, MUTED);
  doc.text('Zaświadczenie wydaje się na prośbę osoby zainteresowanej.', 30, Math.min(y + 5, 214), { maxWidth: 150 });

  font(doc, 'Montserrat', 'normal', 9, MUTED);
  doc.text(`Kąpino, dnia ${d.issuedOn}`, 180, 221, { align: 'right' });
  signature(doc, 112, 180, 232);

  font(doc, 'Montserrat', 'normal', 8, MUTED);
  doc.text(`${ISSUER.name}  ·  NIP ${ISSUER.nip}  ·  ${ISSUER.address}`, 105, 258, { align: 'center' });
  doc.text(ISSUER.contact, 105, 263, { align: 'center' });
  return doc;
};

// Treści zatwierdzone przez Krystiana i Natalię (mail Marcina 03.09.2026)
const stayPlace = 'w Prywatnym Ośrodku Leczenia Uzależnień „My Way” w Kąpinie';

const PROGRAM_BULLETS = [
  '-  rozpoznawaniem i radzeniem sobie z głodem i zachowaniami nałogowymi;',
  '-  uznaniem bezsilności wobec własnego uzależnienia;',
  '-  uświadamianiem sobie destrukcyjnego wpływu nałogu na różne obszary życia;',
  '-  rozpoznawaniem i wyrażaniem emocji;',
  '-  budowaniem motywacji do trzeźwego życia i wprowadzania zmian w swoim funkcjonowaniu.',
].join('\n');

const CONTINUATION =
  'Wskazana jest dalsza kontynuacja leczenia w formie ambulatoryjnej (np. w poradni leczenia uzależnień, indywidualnych spotkań z terapeutą uzależnień bądź psychologiem lub korzystania z grup wsparcia).';

const certificateBody = (kind: Exclude<DischargeDocumentKind, 'dyplom'>, d: DocumentData): string[] => {
  const period = `w terminie od ${d.stayFrom} do ${d.stayTo}`;
  const programHeader = d.inProgress ? 'Program terapeutyczny obejmuje pracę nad:' : 'Program terapeutyczny obejmował pracę nad:';
  switch (kind) {
    case 'pobyt':
      return d.inProgress
        ? [
            `${d.verbs.stayed} ${stayPlace} od dnia ${d.stayFrom}.`,
            `Planowane zakończenie leczenia wypada na dzień ${d.plannedEnd}, z możliwością przedłużenia o kolejny okres terapeutyczny.`,
          ]
        : [`${d.verbs.stayed} ${stayPlace} w okresie od ${d.stayFrom} do ${d.stayTo}.`];
    case 'uczestnictwo':
      return [
        `${d.verbs.participated} w programie terapii podstawowej dla osób uzależnionych, w trybie stacjonarnym, ${period}, ${stayPlace}.`,
        programHeader,
        PROGRAM_BULLETS,
        ...(d.inProgress ? [] : [CONTINUATION]),
      ];
    case 'ukonczenie':
      return [
        `${d.verbs.completed} program terapii podstawowej dla osób uzależnionych, w trybie stacjonarnym, ${period}, ${stayPlace}.`,
        programHeader,
        PROGRAM_BULLETS,
        CONTINUATION,
      ];
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

  font(doc, 'Montserrat', 'bold', 9.5, MUTED);
  textCenteredSpaced(doc, d.salutation.toUpperCase(), 148.5, 96, 2.5);
  font(doc, 'Cormorant', 'bold', 40, TEAL);
  doc.text(d.fullName, 148.5, 110, { align: 'center' });
  font(doc, 'Cormorant', 'normal', 16, INK);
  doc.text(`${d.verbs.completed} podstawowy program terapii uzależnień w trybie stacjonarnym`, 148.5, 122, { align: 'center' });
  font(doc, 'Montserrat', 'normal', 10.5, MUTED);
  doc.text(`w dniach od ${d.stayFrom} do ${d.stayTo}`, 148.5, 130, { align: 'center' });

  // Życzenia zespołu (treść zatwierdzona: mail Marcina 03.09.2026)
  font(doc, 'Cormorant', 'normal', 13.5, NAVY);
  doc.text(`${d.firstName}, życzymy Ci: pogody ducha, abyś ${d.verbs.agreed} się z tym, czego nie możesz zmienić,`, 148.5, 144, { align: 'center' });
  doc.text(`odwagi, abyś ${d.verbs.changed} to, co można zmienić,`, 148.5, 151, { align: 'center' });
  doc.text(`i mądrości, abyś ${d.verbs.discerned} jedno od drugiego.`, 148.5, 158, { align: 'center' });
  font(doc, 'Montserrat', 'normal', 8.5, MUTED);
  doc.text('Zespół terapeutyczny Ośrodka Leczenia Uzależnień My Way', 148.5, 166, { align: 'center' });

  // dolny pas tła to mglisty las: data na środku nad mgłą, podpis po prawej, nic w lewym dolnym rogu
  font(doc, 'Montserrat', 'normal', 9.5, INK);
  doc.text(`Kąpino, ${d.issuedOn}`, 148.5, 174, { align: 'center' });
  signature(doc, 150, 218, 185);
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
