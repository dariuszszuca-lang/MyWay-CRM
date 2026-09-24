# Telefony — zakres do wdrożenia

Stan24.09: backend wdrożony za zgodą Darka, frontend przygotowany do publikacji. Historia kontaktów niezaimportowana. Ostatni sprawdzony punkt wyjścia: `d252335`.

## Funkcje

Menu w osobnym rzędzie, zakładka Telefony z Dziennikiem, Kontaktami, Analizą i Raportami. Formularz odwzorowuje pola materiałów Marcina; każda kolejna rozmowa jest osobnym wpisem. Daty raportów są liczone według polskiego kalendarza. Są filtry, przypomnienia o kontaktach, eksport CSV rozmów, PDF analiz i zapisywanie raportów na żądanie.

Automat codziennie o 00:30 Europe/Warsaw sprawdza zakończone tygodnie, miesiące i lata. Zapisuje raporty do CRM, bez wysyłania maili. Po przerwie uzupełnia okresy od ostatniego poprawnego sprawdzenia. Ponowienie nie dubluje raportów. Pierwsze uruchomienie obejmuje poprzedni tydzień, miesiąc i rok. Raport jest migawką stanu wpisów w chwili generowania; późniejsze korekty danych można uwzględnić raportem na żądanie.

Uprawnienia do Analizy, Raportów i kwot odpowiadają uprawnieniom statystyk CRM, rozszerzonym24.09 na jawne polecenie o konto Darka. Pozostali pracownicy prowadzą kontakty i dziennik. Zapisy mają kontrolę równoczesnej edycji i historię zmian. Rozmowy są dopisywane; nie ma usuwania ani edycji już zapisanego wpisu rozmowy. Dane pacjentów nie są migrowane. Wyliczenia deterministyczne: AI_ACT_CHECK NIE_DOTYCZY.

## Zgoda i kolejność wdrożenia

Wymagana zgoda właściciela na nową funkcję GCP, uprawnienia jej konta serwisowego i nowe reguły Firestore. Przed operacją ponownie sprawdzić zasoby, dokumentację projektu i cloud_safety. Zarejestrować zatwierdzony zakres w inwentarzu zasobów. Nie publikować interfejsu przed backendem.

1. Utworzyć dedykowane konto `myway-phone-reports@myway-crm-a4593.iam.gserviceaccount.com` bez klucza JSON. Nadać niestandardową rolę z niezbędnymi uprawnieniami Firestore get/list/create/update, bez delete i bez Owner/Editor. Ograniczyć binding warunkiem IAM do bazy `(default)` projektu `myway-crm-a4593`; przed nadaniem zweryfikować pełen zestaw permissions wymaganych przez Admin SDK. IAM Firestore nie ogranicza dostępu do pojedynczych kolekcji — ta granica to baza, a Admin SDK pomija reguły klienta. Ograniczenie do `phone*` wynika z kodu funkcji.
2. Uruchomić `bash tools/deploy-telephony.sh --plan`, sprawdzić zgodność zatwierdzonego zakresu, potem `--apply`. Izolowany codebase `telephony` nie wdraża istniejących ośmiu funkcji. Skrypt nie tworzy ani nie zmienia IAM; konto i minimalne uprawnienia są warunkiem wdrożenia.
3. Sprawdzić wdrożoną funkcję, region, konto, harmonogram, logi i `phoneReportState/scheduler`. Potwierdzić idempotencję kontrolowanego uruchomienia. Nie dopisywać testowych kontaktów do produkcji.
4. Po poprawnej kontroli backendu scalić commit aplikacji do `main` i wykonać zwykły push uruchamiający Vercel. Sprawdzić `https://www.myway-crm.pl`, logowanie, uprawnienia, menu, istniejącą Bazę/Kolejkę i nową zakładkę. Zanotować commit w changelogu.

Limity funkcji: 256 MB, 120 sekund, jedna instancja, maksymalnie 3 ponowienia. Jeden job Cloud Scheduler: 0,10 USD/mies. poza pulą 3 darmowych jobów na konto rozliczeniowe, plus zużycie Functions/Firestore/PubSub i przechowywanie artefaktów. Wielkość kosztu zależy od danych i wykorzystanych już limitów; to nie jest stała cena całego modułu. [Cennik Scheduler](https://cloud.google.com/scheduler/pricing).

Node.js 22 zastosowano w nowej funkcji, bez zmiany runtime istniejących funkcji. [Wsparcie runtime](https://docs.cloud.google.com/functions/docs/runtime-support). Warunek dostępu do bazy należy sprawdzić zgodnie z [dokumentacją Firestore](https://firebase.google.com/docs/firestore/manage-databases).

Rollback: przy problemie z interfejsem revert commita funkcji Telefony i push na main. Przy problemie z generowaniem wstrzymać tylko nowy job Scheduler. Zachować kontakty i raporty; żadnego automatycznego kasowania danych ani innych funkcji. Zmiany produkcyjne wykonać w granicach zatwierdzonego planu lub uzyskać zgodę na rozszerzenie.

## Dane historyczne

Odczytano wszystkie 7 załączników z maila Marcina z 23.09.2026. CSV zawiera 725 kontaktów z okresu 01.04–31.07.2026. Przygotowany lokalny podgląd importu: 8 brakujących/niepoprawnych godzin, 8 dat z mieszanymi separatorami, 677 niejednoznacznych czasów do zachowania w surowej postaci, 142 dawne follow-upy wymagające potwierdzenia, 50 wygranych bez daty zamknięcia. Nie przeliczać ocen A–D bez definicji, nie traktować kategorii Sprzedaż jako wpłaty. Skrypt `tools/preview-phone-import.py` tworzy wyłącznie lokalny podgląd; nie importuje nic do Firestore. Import produkcyjny to osobny zakres po akceptacji podglądu.

## Weryfikacja

- `npm test`: 60 testów, w tym granice tygodni/lat, czas PL, liczenie kontaktów i rozmów, walidacja, brakujące dane, powtórzenia harmonogramu.
- `npm run build`: TypeScript i build aplikacji.
- `GCLOUD_PROJECT=demo-myway-telefony FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 node --test tests/integration/phone-rules.mjs`: 7 testów reguł, atomowych zapisów, uprawnień i harmonogramu z Admin SDK; wymaga uruchomionego emulatora i zależności `functions/telephony`.
- Podgląd `npx vite --config tools/phone-preview.config.ts`, dane `node tools/phone-preview/seed.mjs`, kontrola `node tools/phone-preview/check-ui.mjs`; wymaga emulatorów Auth/Firestore według `firebase.telephony-test.json` i lokalnego Chrome. Używa fikcyjnych rekordów i blokuje połączenia przeglądarki poza localhost oraz CDN stylów. Kontrola zapisu, kolejnej rozmowy, PDF, archiwum, szerokości 1440/768/390/320 px, Bazy/Kolejki i uprawnień personelu.

Automatyczne raporty na produkcji będzie można potwierdzić dopiero po wdrożeniu. Lokalna weryfikacja nie zastępuje sprawdzenia IAM i harmonogramu w GCP.

Wdrożenie24.09: konto/rola utworzone skryptem tools/provision-telephony.sh, bez kluczy. Harmonogram utworzony przez Firebase w us-central1 (ustawienie projektu), funkcja europe-west1 i baza eur3; job nie zawiera danych kontaktów. Kill-switch: `gcloud scheduler jobs pause firebase-schedule-phoneReportsScheduled-europe-west1 --project myway-crm-a4593 --location us-central1`. Ostrzeżenie CLI o cleanup policy nie oznacza błędu funkcji; nie włączano kasowania obrazów we współdzielonym repozytorium.
