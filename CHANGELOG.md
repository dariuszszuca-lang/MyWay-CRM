## 2026-09-23 — naprawa dostępu Beaty do danych CRM

Beata mogła zalogować się do interfejsu, lecz brakowało jej na osobnej liście Firestore. Dopisano wyłącznie jej konto do istniejących reguł patients, queue, rooms i roomAssignments. Lista dostępu do statystyk pozostaje bez zmian (Beata wykluczona). Dodano test zgodności list interfejsu i bazy oraz test dostępu Beaty bez statystyk.

Weryfikacja przed wdrożeniem: produkcyjne reguły zgodne z wcześniejszym plikiem, brak konta Beaty; 100 syntetycznych przypadków Rules API potwierdzało odmowę przed i 100 potwierdza poprawny zakres po zmianie, w tym brak dostępu obcych, niezalogowanych i niezweryfikowanych kont. 49 testów aplikacji PASS. Bez odczytu lub zmian kart pacjentów. Wdrożono reguły produkcyjne23.09 o14:24UTC, ruleset `d0674eba-65de-44c1-bf16-34595d595ba9`; ponowny odczyt potwierdza dokładnie dopisanie Beaty. Kod/testy: commit35291bf, push main. HTTP200 na www.myway-crm.pl. Poprzedni ruleset do rollback: 36e71d69-9ded-4206-9135-f35f16c17c59.

# CHANGELOG deployów PROD (zespół używa Vercel www.myway-crm.pl, auto-deploy z `main`; Firebase Hosting myway-crm-a4593.web.app = kopia równoległa, deploy ręczny)

Dostęp Dziennik: zaktualizowano wyłącznie `ORDERS_ALLOWED_EMAILS` istniejącej funkcji `ordersApi` w `eduway-f13c4/europe-west1` (lista5→6, Beata dodana, bez wdrażania kodu funkcji). Operacja zakończona, ACTIVE23.09 o14:27:36UTC. Statystyki: nadal canAccessStats=false; chroniony przycisk, przejście i render zakładki. Odbiór na rzeczywistej sesji Beaty wymaga jej odświeżenia/logowania; nie podszywano się pod użytkownika.

## [2026-09-22] zaświadczenie o uczestnictwie tylko po wypisie
- Zaświadczenie o uczestnictwie w terapii zdjęte z listy dokumentów aktywnych pacjentów (Darek 22.09.2026). Dostępne po wypisie z dowolnym powodem; dyplom i zaświadczenie o ukończeniu nadal tylko przy powodzie „Zakończenie terapii". Zaświadczenie o pobycie i oświadczenie pacjenta bez zmian (także dla aktywnych).
- Podpowiedź w karcie „Dokumenty do wydania" dla aktywnych: „Zaświadczenie o uczestnictwie jest dostępne po wypisie pacjenta."
- Testy 47/47 (nowy test: aktywny pacjent bez uczestnictwa). Deploy: commit `4843afd`, `git push main` → Vercel www.myway-crm.pl, po ok. 45 s bundle `index-DowHjNTN.js` zgodny z lokalnym buildem, HTTP 200. Kopia Firebase NIE aktualizowana.

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
