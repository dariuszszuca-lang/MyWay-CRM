# CHANGELOG deployów PROD (zespół używa Vercel www.myway-crm.pl, auto-deploy z `main`; Firebase Hosting myway-crm-a4593.web.app = kopia równoległa, deploy ręczny)

## [2026-09-05] commit eb72497, oświadczenie pacjenta + zaświadczenia bez grafiki
- Nowy dokument „Oświadczenie pacjenta (odpłatna interwencja medyczna)" na liście zaświadczeń, dla każdego pacjenta (prośba Krystiana 05.09.2026, wzór PDF przez WhatsApp). System uzupełnia imię i nazwisko, PESEL z datą urodzenia i datę przyjęcia; reszta (godzina, promile, koszt, kratki, podpisy) do ręcznego wypełnienia. A4, 2 strony, `services/patientStatement.ts`.
- Zaświadczenia o ukończeniu, pobycie i uczestnictwie w formie urzędowej (prośba Natalii 05.09.2026): biały papier bez tła, logo na górze, czarny druk. Dyplom bez zmian, tło premium zostaje.
- Usunięte `public/dokumenty/tlo-zaswiadczenie.jpg`; `requiredAssets` zwraca `background: null` poza dyplomem.
- Testy 46/46, nowy `tests/discharge-documents-render.test.mjs` pilnuje liczby stron (zaświadczenia 1, oświadczenie 2). Deploy: `git push main` → Vercel, po 20 s bundle `index-Bfvj7XFC.js` zgodny z lokalnym buildem, HTTP 200. Kopia Firebase NIE aktualizowana (nadal `index-DwgBkRS9.js`).

## [2026-09-03] commit e3c8686, dokumenty wypisowe v2
- Nowe treści zaświadczeń (uczestnictwo, ukończenie, pobyt) i dyplomu wg wzorów zatwierdzonych przez Krystiana i Natalię (mail Marcina 03.09.2026).
- Data urodzenia liczona z PESEL na zaświadczeniach (linia „ur. ... · PESEL ...").
- Naprawa zakresu „od-do" przy wystawianiu w trakcie pobytu: pełny planowany pobyt zamiast dnia wystawienia.
- Adnotacja „z możliwością przedłużenia o kolejny okres terapeutyczny" przy pobycie w trakcie.
- Deploy ręczny z /tmp/myway-crm-build, weryfikacja: HTTP 200, bundle index-DwgBkRS9.js zgodny z buildem.
