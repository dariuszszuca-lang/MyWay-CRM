import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { csvCell } from "../../functions/telephony/core.mjs";

export default function ImportedSources() {
  const [sources, setSources] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    getDocs(collection(db, "phoneImportSources")).then(
      (rows) => active && setSources(rows.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => active && setFailed(true),
    );
    return () => { active = false; };
  }, []);
  if (failed) return <p className="text-sm text-amber-800">Nie udało się pobrać materiałów źródłowych importu.</p>;
  if (!sources.length) return null;
  const download = (s: any) => {
    const table = s.format === "table";
    const content = table ? "\uFEFF" + JSON.parse(s.content).map((row: any[]) => row.map(csvCell).join(";")).join("\r\n") : s.content;
    const url = URL.createObjectURL(new Blob([content], { type: table ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${s.id}.${table ? "csv" : "txt"}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details className="bg-white border rounded-xl p-5">
    <summary className="font-semibold cursor-pointer">Materiały źródłowe importu ({sources.length})</summary>
    <p className="text-sm text-gray-500 mt-3">Arkusze i podsumowania Marcina w oryginalnej postaci danych. Nie są doliczane drugi raz do statystyk kontaktów. Dawne wnioski i niejednoznaczne wartości wymagają sprawdzenia.</p>
    <div className="divide-y mt-3">{sources.sort((a,b) => a.title.localeCompare(b.title)).map(s => <div key={s.id} className="py-3 flex flex-wrap justify-between gap-3 items-center">
      <div className="min-w-0"><p className="text-sm font-medium break-words">{s.title}</p><p className="text-xs text-gray-500">{s.description}</p></div>
      <button className="px-3 py-2 border rounded-lg text-sm" onClick={() => download(s)}>Pobierz {s.format === "table" ? "CSV" : "tekst"}</button>
    </div>)}</div>
  </details>;
}
