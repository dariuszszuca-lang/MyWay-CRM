# Import materiałów Marcina — 24.09.2026

Zgoda Darka: „Zaimportuj wszystkie z dokumentów Marcina”. Źródło: 7 załączników wiadomości23.09 „Pliki do analizy telefonów.”. Dane osobowe i załączniki pozostają poza repo.

Zakres: 725 unikalnych identyfikatorów kontaktów, 01.04–31.07.2026. CSV, XLSX, uproszczony Numbers i oryginalny Numbers potwierdzają ten sam zbiór ID. Siedem dodatkowych wpisów Ads uzupełnia istniejące kontakty. Puste arkusze CRM-testy, dziennika i tygodniowego raportu nie tworzą rekordów. Dzienne podsumowania Ads oraz pozostałe źródła są dostępne jako9 tabel/tekstów w Raporty → Materiały źródłowe importu, tylko dla osób z dostępem do statystyk. Nie zwiększają ponownie liczników.

Poprawiono parser dat zamknięcia zawierających godzinę. Po pełnym odczycie:5 wygranych bez poprawnej daty, w tym błędne daty wcześniejsze niż kontakt;8 brakujących/błędnych godzin;677 niejednoznacznych długości rozmowy;142 historyczne follow-upy wymagające potwierdzenia. Surowe wartości zachowano. Nie powstają fikcyjne próby telefonu ani daty wpłat. Historyczne wygrane bez daty można edytować; nie wchodzą do kwot i wygranych według okresu. Nowe kontakty nadal wymagają daty wygranej. Importowane dane nie stają się automatycznie zaległymi zadaniami.

## Skrypty

1. `uv run --with numbers-parser --with openpyxl python tools/prepare-phone-import.py PRIVATE_FOLDER --output PRIVATE_PAYLOAD.json`: wszystkie załączniki, kontrola ID i pustych szablonów, raw źródła, SHA256, prywatny plik0600.
2. `node tools/import-phone-history.mjs PRIVATE_PAYLOAD.json`: wyłącznie odczyt produkcji i plan. Target sztywny myway-crm-a4593, wyłącznie kolekcje phone*. Oczekiwane725 rekordów i7załączników.
3. `node tools/import-phone-history.mjs PRIVATE_PAYLOAD.json --apply`: kopia wcześniejszych kolekcji i payloadu w `~/.local/state/myway-crm/phone-imports/` (0700/0600), atomiczne create-only paczki po50 kontaktów z audytem i opcjonalną kwotą. Każdy zapis ma warunek exists:false. Nie ma API update/delete.
4. Kontrola po zapisie:725zgodnych odcisków źródła, wszystkie istniejące dokumenty identyczne przed/po. Ponowienie pomija już zaimportowane rekordy, również gdy pracownik później poprawił ich treść. KonfliktID lub odcisku zatrzymuje import. Częściowy przebieg można bezpiecznie wznowić tym samym payloadem.

Importer zachowuje manifest7plików oraz9archiwalnych tabel/tekstów. Dodatkowo tworzy4 raporty miesięczne oraz1 raport pełnego zakresu, z wyraźną informacją o danych historycznych. Nie zmienia wcześniej utworzonych raportów ani danych pacjentów. Rollback nie kasuje automatycznie danych: manifest wskazuje dokładne nowe ID; ewentualne usunięcie wymaga osobnego potwierdzenia i sprawdzenia późniejszych edycji.

Weryfikacja:62testy aplikacji,8reguł/uprawnień i1integracyjny test importu na syntetycznych danych w lokalnym emulatorze, w tym atomowość konfliktu, idempotencja i ochrona edycji po imporcie. Build oraz UI sprawdzane przed publikacją. Reguły nowych archiwów read-only dla grupy statystyk. AI_ACT_CHECK NIE_DOTYCZY: deterministyczny import i obliczenia.
