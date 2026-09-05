import type jsPDF from 'jspdf';
import type { DocumentData } from './dischargeDocuments.ts';
import { textCenteredSpaced } from './pdfBase.ts';
import { ISSUER } from './issuer.ts';

// Oświadczenie pacjenta dotyczące zlecenia odpłatnej interwencji medycznej i pokrycia jej kosztów.
// Wzór: PDF od Krystiana (WhatsApp 05.09.2026), treść przepisana 1:1. System uzupełnia wyłącznie dane
// z karty pacjenta (imię i nazwisko, PESEL z datą urodzenia, data przyjęcia); resztę wypełnia ręcznie
// pracownik przy przyjęciu. Forma urzędowa (prośba Natalii 05.09.2026): biały papier, logo na górze,
// czarny druk, bez tła i ozdobników. Funkcja dostaje gotowy jsPDF z zarejestrowanymi fontami
// (prepare w dischargeDocuments) i sama tylko rysuje oraz łamie strony.

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const GRAY: RGB = [95, 95, 95];

const LEFT = 25;
const RIGHT = 185;
const WIDTH = RIGHT - LEFT;
const TOP = 20;      // początek treści na kolejnych stronach
const BOTTOM = 272;  // dolna granica treści, niżej tylko stopka
const LOGO_RATIO = 345 / 1196;
const BODY = 9;      // stopień pisma treści (pt)
const BLANK = 7.5;   // wysokość linii na wpis ręczny (mm)

type Ctx = { doc: jsPDF; y: number };
type Family = 'Cormorant' | 'Montserrat';

const mm = (pt: number) => pt * 0.3528;
const lineHeight = (size: number, factor = 1.4) => mm(size) * factor;

const setFont = (doc: jsPDF, family: Family, style: 'normal' | 'bold', size: number, color: RGB) => {
  doc.setFont(family, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

// Łamanie strony: jeśli blok o podanej wysokości nie mieści się nad stopką, zaczynamy nową stronę
const ensure = (c: Ctx, needed: number) => {
  if (c.y + needed > BOTTOM) {
    c.doc.addPage();
    c.y = TOP;
  }
};

const dotted = (doc: jsPDF, x1: number, x2: number, y: number) => {
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([0.4, 0.9], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
};

interface ParagraphOptions {
  family?: Family;
  style?: 'normal' | 'bold';
  size?: number;
  color?: RGB;
  align?: 'left' | 'center';
  width?: number;
  gap?: number;      // odstęp pod akapitem (mm)
  keepWith?: number; // ile mm treści pod akapitem ma się jeszcze zmieścić na tej samej stronie
}

// Akapit z automatycznym łamaniem wierszy i stron. c.y to górna krawędź bloku.
const paragraph = (c: Ctx, text: string, o: ParagraphOptions = {}) => {
  const size = o.size ?? BODY;
  setFont(c.doc, o.family ?? 'Montserrat', o.style ?? 'normal', size, o.color ?? BLACK);
  const lines = c.doc.splitTextToSize(text, o.width ?? WIDTH) as string[];
  const lh = lineHeight(size);
  ensure(c, lh * lines.length + (o.keepWith ?? 0));
  const x = o.align === 'center' ? 105 : LEFT;
  c.doc.text(lines, x, c.y + mm(size), { lineHeightFactor: 1.4, align: o.align ?? 'left' });
  c.y += lh * lines.length + (o.gap ?? 2.5);
};

// Nagłówek sekcji nie zostaje sam na dole strony: wymaga miejsca na siebie i dwa wiersze treści
const heading = (c: Ctx, text: string) => {
  ensure(c, 24);
  c.y += 1;
  paragraph(c, text, { style: 'bold', size: 10.5, gap: 3 });
};

// Separator sekcji. Na świeżej stronie zbędny (kreska na samej górze wyglądałaby jak błąd druku).
const rule = (c: Ctx) => {
  ensure(c, 8);
  if (c.y <= TOP) return;
  c.doc.setDrawColor(...GRAY);
  c.doc.setLineWidth(0.2);
  c.doc.line(LEFT, c.y + 1.5, RIGHT, c.y + 1.5);
  c.y += 4.5;
};

// Pole formularza: etykieta, a po niej wartość z systemu (pogrubiona) albo kropki do ręcznego wpisania
const field = (c: Ctx, label: string, value?: string, o: { width?: number; suffix?: string } = {}) => {
  const lh = lineHeight(BODY, 1.5);
  ensure(c, lh + 1.5);
  const baseline = c.y + mm(BODY);
  setFont(c.doc, 'Montserrat', 'normal', BODY, BLACK);
  if (label) c.doc.text(label, LEFT, baseline);
  const start = label ? LEFT + c.doc.getTextWidth(label) + 2 : LEFT;
  let end = o.width ? Math.min(start + o.width, RIGHT) : RIGHT;
  if (o.suffix) {
    c.doc.text(o.suffix, end, baseline, { align: 'right' });
    end -= c.doc.getTextWidth(o.suffix) + 2;
  }
  if (value) {
    setFont(c.doc, 'Montserrat', 'bold', BODY, BLACK);
    c.doc.text(value, start, baseline);
  } else {
    dotted(c.doc, start, end, baseline + 0.7);
  }
  c.y += lh + 1.5;
};

// Dwa krótkie pola w jednym wierszu (np. Data / Godzina)
const fieldPair = (c: Ctx, a: string, b: string) => {
  const lh = lineHeight(BODY, 1.5);
  ensure(c, lh + 1.5);
  const baseline = c.y + mm(BODY);
  const half = WIDTH / 2;
  setFont(c.doc, 'Montserrat', 'normal', BODY, BLACK);
  for (const [label, x0] of [[a, LEFT], [b, LEFT + half]] as Array<[string, number]>) {
    c.doc.text(label, x0, baseline);
    dotted(c.doc, x0 + c.doc.getTextWidth(label) + 2, x0 + half - 6, baseline + 0.7);
  }
  c.y += lh + 1.5;
};

// Kratka do zaznaczenia. Rysowana, nie znak ☐, bo font nie musi go mieć.
const checkbox = (c: Ctx, text: string, o: { trailingLine?: boolean } = {}) => {
  setFont(c.doc, 'Montserrat', 'normal', BODY, BLACK);
  const lines = c.doc.splitTextToSize(text, WIDTH - 8) as string[];
  const lh = lineHeight(BODY);
  ensure(c, lh * lines.length + 1.5);
  const baseline = c.y + mm(BODY);
  c.doc.setDrawColor(...BLACK);
  c.doc.setLineWidth(0.3);
  c.doc.rect(LEFT + 0.5, baseline - 3.1, 3.4, 3.4);
  c.doc.text(lines, LEFT + 7, baseline, { lineHeightFactor: 1.4 });
  if (o.trailingLine && lines.length === 1) {
    dotted(c.doc, LEFT + 7 + c.doc.getTextWidth(text) + 2, RIGHT, baseline + 0.7);
  }
  c.y += lh * lines.length + 2;
};

// Etykieta i pod nią linie na wpis ręczny (uwagi, podpisy). Trzymają się razem na jednej stronie.
const labelled = (c: Ctx, label: string, lines: number, width = WIDTH) => {
  ensure(c, lineHeight(BODY) + BLANK * lines);
  paragraph(c, label, { gap: 0 });
  for (let i = 0; i < lines; i++) {
    dotted(c.doc, LEFT, LEFT + width, c.y + BLANK - 1.5);
    c.y += BLANK;
  }
  c.y += 1;
};

// PESEL i data urodzenia w jednej linii; brak obu = kropki do ręcznego wpisania
const identityLine = (d: DocumentData): string | undefined => {
  const parts = [d.pesel?.trim(), d.birthDate ? `ur. ${d.birthDate} r.` : ''].filter(Boolean);
  return parts.length ? parts.join('  /  ') : undefined;
};

export const drawPatientStatement = (doc: jsPDF, logo: Uint8Array, d: DocumentData): jsPDF => {
  const c: Ctx = { doc, y: 0 };

  // Papier firmowy: logo i nazwa wydawcy jak na zaświadczeniach
  const logoW = 46;
  doc.addImage(logo, 'PNG', 105 - logoW / 2, 12, logoW, logoW * LOGO_RATIO);
  setFont(doc, 'Montserrat', 'bold', 8, BLACK);
  textCenteredSpaced(doc, ISSUER.name.toUpperCase(), 105, 32, 1.2);

  c.y = 40;
  paragraph(c, 'OŚWIADCZENIE PACJENTA', { family: 'Cormorant', style: 'bold', size: 22, align: 'center', gap: 1 });
  paragraph(c, 'dotyczące zlecenia odpłatnej interwencji medycznej i pokrycia jej kosztów', { style: 'bold', size: 9, align: 'center', gap: 2 });
  paragraph(c, 'Prywatny Ośrodek Terapii Uzależnień „My Way”', { size: 9, color: GRAY, align: 'center', gap: 3 });
  rule(c);

  heading(c, 'Dane pacjenta');
  field(c, 'Imię i nazwisko:', d.fullName || undefined);
  field(c, 'PESEL / data urodzenia:', identityLine(d));
  field(c, 'Data przyjęcia do Ośrodka:', d.stayFrom || undefined);
  field(c, 'Godzina przyjęcia:');
  field(c, 'Wynik badania trzeźwości przy przyjęciu:', undefined, { width: 50, suffix: '‰' });
  rule(c);

  heading(c, 'Oświadczenie');
  paragraph(c, 'W związku z przyjazdem do Ośrodka pod wpływem alkoholu i koniecznością oceny mojego stanu zdrowia zostałem/am poinformowany/a o możliwości skorzystania z odpłatnej interwencji medycznej realizowanej przez zewnętrzny podmiot medyczny.');
  paragraph(c, 'Na podstawie przekazanej mi informacji zlecam Ośrodkowi zamówienie odpłatnej interwencji medycznej, obejmującej w szczególności przyjazd personelu medycznego, ocenę stanu zdrowia oraz – jeżeli zostanie to zakwalifikowane przez osobę wykonującą zawód medyczny – wykonanie wlewu dożylnego („kroplówki”).');

  heading(c, 'Koszt');
  paragraph(c, 'Ustalony koszt interwencji medycznej wynosi:', { gap: 1.5, keepWith: 14 });
  field(c, '', undefined, { width: 60, suffix: 'zł' });
  field(c, 'słownie:');
  paragraph(c, 'Przyjmuję do wiadomości, że koszt powstaje w związku z zamówieniem i rozpoczęciem realizacji interwencji medycznej przez podmiot zewnętrzny.');
  paragraph(c, 'Jeżeli po przyjeździe personelu medycznego, rozpoczęciu badania, przygotowaniu świadczenia lub rozpoczęciu podawania kroplówki zrezygnuję z dalszego wykonywania świadczenia, zobowiązuję się do pokrycia kosztu rzeczywiście obciążającego Ośrodek zgodnie z cennikiem lub rozliczeniem podmiotu realizującego świadczenie.');
  paragraph(c, 'Rozumiem, że mam prawo odmówić udzielenia świadczenia medycznego lub zażądać jego przerwania. Rezygnacja z dalszego wykonywania świadczenia nie powoduje jednak automatycznego anulowania kosztów, które zostały już poniesione wskutek zamówienia lub rozpoczęcia realizacji usługi.');
  paragraph(c, 'Koszt świadczenia:', { gap: 1.5, keepWith: 21 });
  checkbox(c, 'został opłacony przed zamówieniem usługi');
  checkbox(c, 'zostanie doliczony do rozliczenia mojego pobytu w Ośrodku');
  checkbox(c, 'zostanie opłacony przez:', { trailingLine: true });
  rule(c);

  heading(c, 'Potwierdzenie pacjenta');
  paragraph(c, 'Oświadczam, że powyższa informacja została mi przekazana w sposób dla mnie zrozumiały.');
  paragraph(c, 'Rozumiem wysokość i zasady naliczania kosztu oraz wyrażam zgodę na obciążenie mnie kosztami zamówionej interwencji medycznej na zasadach opisanych powyżej.');
  fieldPair(c, 'Data:', 'Godzina:');
  labelled(c, 'Czytelny podpis pacjenta:', 1, 110);
  rule(c);

  heading(c, 'Potwierdzenie pracownika Ośrodka');
  paragraph(c, 'Potwierdzam, że przed zamówieniem usługi poinformowałem/am pacjenta o jej przewidywanym koszcie oraz zasadach rozliczenia.');
  paragraph(c, 'W chwili przekazywania informacji pacjent:', { gap: 1.5, keepWith: 14 });
  checkbox(c, 'nawiązywał logiczny kontakt i był w stanie zrozumieć przekazywane informacje');
  checkbox(c, 'występowały wątpliwości co do zdolności pacjenta do świadomego zrozumienia informacji – nie oparto zamówienia usługi wyłącznie na podpisie pacjenta');
  labelled(c, 'Uwagi:', 2);
  field(c, 'Imię i nazwisko pracownika:');
  field(c, 'Data i godzina:');
  labelled(c, 'Podpis pracownika:', 1, 110);
  rule(c);

  heading(c, 'Dane realizatora świadczenia');
  labelled(c, 'Nazwa podmiotu / osoba wykonująca świadczenie:', 1);
  fieldPair(c, 'Godzina wezwania:', 'Godzina przyjazdu:');
  paragraph(c, 'Świadczenie:', { gap: 1.5, keepWith: 21 });
  checkbox(c, 'wykonano w całości');
  checkbox(c, 'rozpoczęto, następnie pacjent zrezygnował');
  checkbox(c, 'nie rozpoczęto');
  labelled(c, 'Uwagi:', 2);

  // Stopka na każdej stronie: wydawca i numer strony
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    setFont(doc, 'Montserrat', 'normal', 7.5, GRAY);
    doc.text(`${ISSUER.name}  ·  NIP ${ISSUER.nip}  ·  ${ISSUER.address}`, 105, 283, { align: 'center' });
    doc.text(`Strona ${page} z ${total}`, 105, 288, { align: 'center' });
  }
  return doc;
};
