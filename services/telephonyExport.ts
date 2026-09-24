import { csvCell } from "../functions/telephony/core.mjs";
import { createPdf, registerFont, fetchAsset } from "./pdfBase";
import autoTable from "jspdf-autotable";
import type { PhoneReport, PhoneContact, PhoneCall } from "./telephony";
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportPhoneCsv(contacts: PhoneContact[], calls: PhoneCall[]) {
  const map = new Map(contacts.map((c) => [c.id, c]));
  const rows = [
    [
      "Data",
      "Godzina PL",
      "Kontakt",
      "Telefon",
      "Typ",
      "Sekundy",
      "Wynik",
      "Odebrany",
      "Pełna rozmowa",
      "Oddzwoniono",
      "Źródło",
      "Ocena",
      "Notatka",
    ],
    ...calls.map((c) => [
      c.date,
      c.time,
      map.get(c.contactId)?.label || c.contactId,
      map.get(c.contactId)?.phone,
      c.kind,
      c.durationSeconds,
      c.result,
      c.answered ? "Tak" : "Nie",
      c.fullConversation ? "Tak" : "Nie",
      c.callback ? "Tak" : "Nie",
      map.get(c.contactId)?.source,
      map.get(c.contactId)?.quality,
      c.note,
    ]),
  ];
  download(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "myway-telefony.csv",
  );
}
export async function exportPhonePdf(report: Omit<PhoneReport, "id">) {
  const pdf = createPdf();
  await registerFont(
    pdf,
    fetchAsset,
    "/dokumenty/fonts/Montserrat-Regular.ttf",
    "Report",
    "normal",
  );
  await registerFont(
    pdf,
    fetchAsset,
    "/dokumenty/fonts/Montserrat-SemiBold.ttf",
    "Report",
    "bold",
  );
  pdf.setFont("Report", "bold");
  pdf.setTextColor(15, 118, 110);
  pdf.setFontSize(20);
  pdf.text("MyWay | Telefony", 14, 20);
  pdf.setFont("Report", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(60);
  pdf.text(`${report.from} – ${report.to}`, 14, 29);
  pdf.text(
    `Wygenerowano: ${new Date(report.generatedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}`,
    14,
    35,
  );
  const filters =
    Object.entries(report.filters || {})
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `${({ source: "Źródło", owner: "Opiekun", quality: "Ocena", category: "Kategoria", kind: "Typ" } as any)[k] || k}: ${v === "__empty" ? "Brak danych" : v}`,
      )
      .join(", ") || "Wszystkie kontakty i rozmowy";
  const lines = pdf.splitTextToSize(filters, 180);
  pdf.text(lines, 14, 41);
  const s = report.summary;
  const body = [
    ["Nowe kontakty", s.newContacts],
    ["Próby telefonu", s.attempts],
    ["Wygrane według daty zamknięcia", s.won],
    ["W tym z wcześniejszych kontaktów", s.wonEarlier],
    ["Kwota zamknięć (nie wpłat)", `${s.revenue} zł`],
    ["Wygrane bez kwoty", s.missingAmounts],
    [
      "Konwersja nowych kontaktów",
      s.cohortConversion === null
        ? "Brak danych"
        : `${s.cohortConversion}% (${s.cohortWon}/${s.newContacts}), stan ${s.asOf}`,
    ],
    ["Kontakty NFZ", s.nfzShare === null ? "Brak danych" : `${s.nfzShare}%`],
    ["Czas rozmów", `${(s.durationSeconds / 60).toFixed(1)} min`],
    ["Próby bez czasu", s.missingDurations],
    ["Kolejne rozmowy", s.followups],
    ["Odebrane / pełne rozmowy", `${s.answered} / ${s.fullConversations}`],
    ["Oddzwonienia", s.callbacks],
    ["Wartościowe wyniki", s.valuable],
    ["Kontakt dziś / zaległe (stan raportu)", `${s.dueToday} / ${s.overdue}`],
  ];
  autoTable(pdf, {
    startY: 45 + lines.length * 4,
    head: [["Miara", "Wynik"]],
    body,
    styles: { font: "Report", fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  let y = (pdf as any).lastAutoTable.finalY + 10;
  for (const line of s.insights) {
    const parts = pdf.splitTextToSize(line, 180);
    if (y + parts.length * 5 > 275) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFontSize(9);
    pdf.text(parts, 14, y);
    y += parts.length * 5 + 3;
  }
  for (const [title, values] of [
    ["Oceny", s.qualities],
    ["Kategorie", s.categories],
    ["Źródła", s.sources],
    ["Statusy", s.statuses],
    ["Etapy", s.stages || {}],
    ["Temperatura", s.temperatures || {}],
    ["Województwa", s.provinces || {}],
    ["Opiekunowie", s.owners || {}],
    ["Wyniki rozmów", s.results],
    ["Powody odpadnięcia", s.lossReasons],
  ] as const) {
    if (y > 230) {
      pdf.addPage();
      y = 20;
    }
    autoTable(pdf, {
      startY: y,
      head: [[title, "Liczba"]],
      body: Object.entries(values).map(([k, v]) => [k, String(v)]),
      styles: { font: "Report", fontSize: 9 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    y = (pdf as any).lastAutoTable.finalY + 8;
  }
  pdf.addPage();
  pdf.setFontSize(13);
  pdf.text("Godziny rozmów (Polska)", 14, 20);
  autoTable(pdf, {
    startY: 27,
    head: [
      ["Godz.", "Próby", "Wartościowe", "Minuty", "Kolejne", "Wart. / 60 min"],
    ],
    body: s.hours
      .filter((h: any) => h.attempts)
      .map((h: any) => [
        `${h.hour}:00`,
        h.attempts,
        h.valuable,
        (h.seconds / 60).toFixed(1),
        h.followups,
        h.valuablePerHour === null ? "Brak danych" : h.valuablePerHour,
      ]),
    styles: { font: "Report", fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  y = (pdf as any).lastAutoTable.finalY + 8;
  autoTable(pdf, {
    startY: y,
    head: [["Dzień tygodnia", "Próby", "Wartościowe"]],
    body: s.days.map((d: any) => [
      [
        "Poniedziałek",
        "Wtorek",
        "Środa",
        "Czwartek",
        "Piątek",
        "Sobota",
        "Niedziela",
      ][d.day],
      d.attempts,
      d.valuable,
    ]),
    styles: { font: "Report", fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  y = (pdf as any).lastAutoTable.finalY + 8;
  autoTable(pdf, {
    startY: y,
    head: [["Godzina pierwszego kontaktu", "Kontakty", "Kategoria Sprzedaż"]],
    body: s.historical
      .filter((h: any) => h.contacts)
      .map((h: any) => [`${h.hour}:00`, h.contacts, h.salesCategory]),
    styles: { font: "Report", fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`MyWay • Raport na podstawie wpisów • ${p}/${total}`, 14, 288);
  }
  pdf.save(`myway-telefony-${report.from}-${report.to}.pdf`);
}
