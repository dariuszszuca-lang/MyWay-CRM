import jsPDF from 'jspdf';
import type { jsPDFOptions } from 'jspdf';

// Wspólna baza dla wszystkich PDF-ów CRM: fonty z polskimi znakami i nagłówek MyWay.
// Plik importuje tylko jspdf, więc narzędzia w tools/ mogą go uruchomić w Node bez bundlera.

// Roboto z pdfmake (CDN): jedyne fonty z polskimi znakami, które jsPDF ma na pewno
const FONT_URL_REGULAR = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
const FONT_URL_BOLD = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary); // globalne btoa: przeglądarka i Node 16+
};

// Zasoby dokumentów (fonty, tła, logo) leżą w public/dokumenty i są serwowane z korzenia aplikacji.
// Loader jest wstrzykiwany, żeby narzędzia w tools/ mogły czytać te same pliki z dysku w Node.
export type AssetLoader = (path: string) => Promise<ArrayBuffer>;

export const fetchAsset: AssetLoader = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Brak zasobu ${path} (HTTP ${response.status})`);
  return response.arrayBuffer();
};

export const registerFont = async (doc: jsPDF, loadAsset: AssetLoader, path: string, family: string, style: 'normal' | 'bold') => {
  const file = path.split('/').pop() || path;
  doc.addFileToVFS(file, arrayBufferToBase64(await loadAsset(path)));
  doc.addFont(file, family, style);
};

// Wyśrodkowany tekst z rozstrzeleniem liter (jsPDF nie uwzględnia charSpace przy align: center)
export const textCenteredSpaced = (doc: jsPDF, text: string, centerX: number, y: number, charSpace: number) => {
  const width = doc.getTextWidth(text) + charSpace * Math.max(text.length - 1, 0);
  doc.text(text, centerX - width / 2, y, { charSpace });
};

// W przeglądarce (Vite) domyślny eksport jspdf to klasa; w Node (CommonJS) to obiekt modułu z polem jsPDF.
export const createPdf = (options?: jsPDFOptions): jsPDF => {
  const Ctor = ((jsPDF as unknown as { jsPDF?: typeof jsPDF }).jsPDF ?? jsPDF) as typeof jsPDF;
  return new Ctor(options);
};

export const loadFonts = async (doc: jsPDF) => {
  try {
    const regularResponse = await fetch(FONT_URL_REGULAR);
    const regularBlob = await regularResponse.arrayBuffer();
    doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regularBlob));
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    const boldResponse = await fetch(FONT_URL_BOLD);
    const boldBlob = await boldResponse.arrayBuffer();
    doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(boldBlob));
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto');
    return true;
  } catch (error) {
    console.error('Error loading fonts', error);
    return false;
  }
};

// Standardowy nagłówek tekstowy (brak pliku z logo w repo): „MyWay" w kolorze teal, prawy górny róg A4 pionowo
export const addLogo = (doc: jsPDF) => {
  doc.setFontSize(18);
  doc.setTextColor(13, 148, 136); // Teal-600
  doc.setFont('Roboto', 'bold');
  doc.text('MyWay', 170, 15, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('OŚRODEK LECZENIA UZALEŻNIEŃ', 170, 20, { align: 'right' });
  doc.setTextColor(0);
};
