## 2026-09-24 — sekcja aplikacji MyWay (QR) w mailach powitalnym i pożegnalnym, deploy do myway-point-app

Ustalenie z logów: żywe maile pacjentów wysyłają funkcje `onPatientConfirmed`/`onPatientDischarged` w projekcie Firebase `myway-point-app` (repo MyWayPoint-Rezerwacje, `functions/index.js`), bo front (`services/getResponseService.ts`, CF_BASE) woła ten projekt. Kopia funkcji w `myway-crm-a4593` (deploy 22.04.2026) nie ma wywołań. Zmiany szablonów maili robić w repo MyWayPoint. W tym repo: helper `getAppSectionHtml/Plain` (commit ef7176f), test `tests/app-section-email.test.mjs`, podgląd bez Firebase `tools/podglad-maili-pacjenta.mjs`; 65 testów PASS. Deploy PROD 24.09 20:05 UTC z repo MyWayPoint (commit 5bace2f): sekcja aplikacji (`https://myway-app-d3b78.web.app`, QR `https://osrodek-myway.pl/aplikacja-myway-qr.png`) + port z tego repo: informacja o detoksie, CAMPAIGN_IDS 6tyg/8tyg/6tyg_roz/8tyg_roz/interwencyjna/vip. Nadawca, klucze, wyzwalacze bez zmian. Kontrola po deployu: OPTIONS 204, GET 405, POST pusty 400, logi bez błędów. Rollback: `git revert 5bace2f` w MyWayPoint + `firebase deploy --only functions:onPatientConfirmed,functions:onPatientDischarged,functions:addPatientToGetResponse,functions:createPatientFromCRM --project myway-point-app`. Do zrobienia przed 30.10.2026: runtime Node 20 → 22. AI_ACT_CHECK NIE_DOTYCZY: szablon maila transakcyjnego bez treści generowanej w locie.

## 2026-09-24 — węższy podgląd uwag

Kolumna Uwagi ma stałe 184 px, dwie linie szarego podglądu i mały link do panelu. Usunięto żółte tło i obramowanie podglądu. Wyłącznie zmiana prezentacji, bez zmiany treści lub mechanizmu zapisu. Build PASS; rzeczywisty PatientList z syntetyczną długą notatką: szerokość 184 px, dwie linie, cała treść w panelu, zero błędów JS. AI_ACT_CHECK NIE_DOTYCZY: korekta układu zwykłego edytora.

## 2026-09-24 — czytelne uwagi w Bazie

W kolumnie Uwagi: podgląd czterech linii i przycisk „Otwórz uwagi”. Edycja w panelu z prawej strony (600 px, pełny ekran na telefonie), jawny zapis/anulowanie, ostrzeżenie przed utratą zmian. Zapis transakcyjny aktualizuje wyłącznie notes i odmawia nadpisania uwag zmienionych równolegle; błąd zachowuje tekst. Bez migracji i zmian innych pól pacjentów. Kontrola w Chrome na danych syntetycznych: zapis, ponowne otwarcie, anulowanie, Escape, ochrona zmian, błąd zapisu i układ 1440/390 px PASS, zero błędów JS. Build PASS.

AI_ACT_CHECK: NIE_DOTYCZY — zwykły edytor tekstu bez funkcji AI; oznaczenia i rejestr nie dotyczą.

## 2026-09-24 — import historii telefonów, zakończony

Na jawne polecenie Darka: import725 kontaktów ze wszystkich7załączników,7uzupełnień Ads,9źródeł w archiwum i5raportów. Skrypt create-only z prywatną kopią stanu i kontrolą ponowień, bez nadpisywania danych. Obsługa brakujących dat historycznych wygranych i zachowanie surowych wartości. Szczegóły w docs/telefony-import.md. Import zakończony24.09 09:30UTC; wszystkie725rekordów i48kwot odczytano i porównano.9źródeł i5raportów dostępnych. Ponowny plan nie tworzy duplikatów. Kodd630adc/16f8c60, VercelSUCCESS,HTTP200,71testów i kontroleUI PASS. Dane pacjentów i wcześniejsze raporty bez zmian.

## 2026-09-24 — Telefony i dostęp Darka do statystyk

Kod dbd43ae + e775743: dziennik kontaktów/rozmów, analiza, CSV/PDF, raporty na żądanie i automaty tygodnia/miesiąca/roku. Menu w osobnym rzędzie. Na jawne polecenie Darka konto dariusz.szuca@gmail.com otrzymuje dostęp do statystyk i finansów telefonów; pozostałe uprawnienia bez zmian. 60 testów aplikacji, 7 integracyjnych i build PASS. Poprzedni commit produkcyjny d252335; kopia poprzednich reguł zgodna z baseline, ruleset91a44df6-e70c-46b4-a3cf-1f7cbdc81276.

Backend: phoneReportsScheduled ACTIVE w europe-west1, Node22, dedykowany SA i custom role z 4 uprawnieniami dokumentów bez delete, ograniczone IAM do bazy domyślnej. Pierwszy przebieg24.09 09:06UTC utworzył3raporty, statusok. Funkcje istniejące nie były wdrażane. Firebase utworzył job w us-central1 zgodnie z konfiguracją schedulera projektu; job niesie wyłącznie sygnał PubSub, obliczenia w europe-west1, baza w eur3. Codziennie00:30Europe/Warsaw. CLI zakończyło ostrzeżeniem o braku cleanup policy artefaktów po udanym wdrożeniu; bez włączania automatycznego kasowania we współdzielonym repozytorium obrazów.

Bez importu historii, wysyłek i zmian danych pacjentów. AI_ACT_CHECK NIE_DOTYCZY: deterministyczna analiza. Frontend: publikacja po potwierdzeniu backendu.

## 2026-09-23 — dostęp zespołu według listy Darka

Dodano Waldka, Stanisława, Patrycję i Małgosię do aplikacji i reguł Firestore, bez statystyk. Natalia Pucz zachowuje pełny dostęp ze statystykami. Te same cztery konta są dodawane do ORDERS_ALLOWED_EMAILS funkcji ordersApi (Dziennik), z zachowaniem istniejących sześciu kont i pozostałej konfiguracji. Adresy zweryfikowane z przekazanym zrzutem. 50 testów aplikacji i build PASS; Rules API: 180 przypadków przed i 180 po zmianie PASS, również odmowy dla kont obcych i niezweryfikowanych. Bez zmian danych pacjentów. Rollback: commit aadad43 i ruleset d0674eba-65de-44c1-bf16-34595d595ba9.

Odbiór frontendu i bazy: commit978e8fa, Vercel HTTP200, bundle index-B-z0T785.js zgodny z lokalnym buildem i zawierający cztery nowe konta. Firestore ruleset91a44df6-e70c-46b4-a3cf-1f7cbdc81276; ponowny odczyt zgodny z lokalnym plikiem.

Odbiór Dziennika: ordersApi ACTIVE23.09 o16:14:24UTC, lista10kont. Sprawdzenie po operacji: cała konfiguracja środowiska zgodna z oczekiwaną, jedyna zmiana to cztery adresy; kod, runtime i konto usługi bez zmian.

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
