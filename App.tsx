import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Patient, QueuePatient, Payment, getAmountDue, formatCurrency, isPackageWithoutMails } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import QueueForm from './components/QueueForm';
import QueueList from './components/QueueList';
import Login from './components/Login';
import StatsDashboard from './components/StatsDashboard';
import RoomsTab from './components/RoomsTab';
import ReportsTab from './components/ReportsTab';
import DziennikTab from './components/DziennikTab';
const TelefonyTab = lazy(() => import('./components/TelefonyTab'));
import { Activity, Users, Cloud, RefreshCw, LogOut, Clock, BarChart3, AlertTriangle, BedDouble, FileText, Package, Phone } from 'lucide-react';
import { Sesja, sesja as pobierzSesje, wyloguj } from './services/aws/auth';
import { nasluchuj, ustawObslugeWygasniecia } from './services/aws/api';
import { AWS_CONFIG } from './services/aws/config';
import { sendWelcomeEmail, confirmPatientEmail, dischargePatientEmail } from './services/getResponseService';
import {
  DaneWypisu, dodajDoKolejki, dodajPacjenta, dodajWplate, integracjeWlaczone, pobierzKarteKolejki, pobierzKolejke, pobierzPacjentow, pobierzPelnego,
  przywroc, usunPacjenta, usunZKolejki, wypisz, zapiszKolejke, zapiszNotatki, zapiszPacjenta, zmienWypis,
} from './services/aws/dane';

// Gałąź aws: dane i logowanie na koncie AWS MyWay (Frankfurt).
// Maile do pacjentów, listy GetResponse i synchronizacja z MyWayPoint działają jak w obecnym CRM
// (te same funkcje myway-point-app), z jednym wyjątkiem: w ośrodkach testowych są wyłączone,
// żeby fikcyjne dane nie trafiały do prawdziwych list i skrzynek.
// Dziennik: te same zamówienia z projektu EduWay (ordersApi), autoryzacja tokenem z nowego logowania.
type ActiveTab = 'form' | 'list' | 'queue' | 'stats' | 'rooms' | 'reports' | 'dziennik' | 'telefony';

const komunikat = (e: unknown) => (e instanceof Error ? e.message : 'Nieznany błąd.');

const App: React.FC = () => {
  const [user, setUser] = useState<Sesja | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from queue → form
  const [prefillQueue, setPrefillQueue] = useState<QueuePatient | null>(null);
  const [admittingQueueId, setAdmittingQueueId] = useState<string | null>(null);

  // 1. Sesja: przy starcie sprawdzamy, czy w tej karcie jest ważne logowanie.
  useEffect(() => {
    ustawObslugeWygasniecia(() => { setUser(null); setPermissionError('Sesja wygasła. Zaloguj się ponownie.'); });
    pobierzSesje().then((s) => { setUser(s); setAuthLoading(false); });
  }, []);

  const wczytajPacjentow = useCallback(async () => {
    try {
      setPatients(await pobierzPacjentow());
      setError(null);
    } catch (e) {
      setError(`Problem z pobraniem danych. ${komunikat(e)}`);
    }
  }, []);

  const wczytajKolejke = useCallback(async () => {
    try {
      setQueue(await pobierzKolejke());
    } catch (e) {
      console.error('Błąd kolejki:', komunikat(e));
    }
  }, []);

  // 2. Dane: wczytanie po zalogowaniu, odświeżanie co 20 s i od razu po każdym zapisie (decyzja D3).
  useEffect(() => {
    if (!user) {
      setPatients([]);
      setQueue([]);
      return;
    }
    setDataLoading(true);
    Promise.all([wczytajPacjentow(), wczytajKolejke()]).finally(() => setDataLoading(false));
    const odlaczP = nasluchuj('pacjenci', wczytajPacjentow);
    const odlaczK = nasluchuj('kolejka', wczytajKolejke);
    const zegar = window.setInterval(() => { wczytajPacjentow(); wczytajKolejke(); }, AWS_CONFIG.odswiezanieMs);
    return () => { odlaczP(); odlaczK(); window.clearInterval(zegar); };
  }, [user, wczytajPacjentow, wczytajKolejke]);

  // --- PATIENT CRUD ---
  const handleAddPatient = async (patientData: Patient) => {
    try {
      const zKolejki = admittingQueueId ? queue.find((q) => q.id === admittingQueueId) || prefillQueue || undefined : undefined;
      const noweId = await dodajPacjenta(patientData, zKolejki || undefined);

      // Jak w obecnym CRM: listy GetResponse oraz, dla pakietu 3, konto w MyWayPoint (20 sesji).
      // (Wywołanie notifyNewPatient pominięte: ten adres nie istnieje, obecny CRM ignorował jego błąd.)
      if (integracjeWlaczone() && !isPackageWithoutMails(patientData.package)) {
        const emailSent = await sendWelcomeEmail({
          email: patientData.email,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          package: patientData.package,
          phone: patientData.phone,
        });
        if (!emailSent) console.warn('⚠️ Nie udało się dodać pacjenta do GetResponse');

        if (patientData.package === '3') {
          try {
            const response = await fetch('https://europe-west1-myway-point-app.cloudfunctions.net/createPatientFromCRM', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                email: patientData.email,
                phone: patientData.phone,
                totalSessions: 20,
                crmPatientId: noweId,
              }),
            });
            if (!response.ok) console.error('MyWayPoint sync error:', response.status);
          } catch (syncError) {
            console.error('MyWayPoint sync failed:', komunikat(syncError));
          }
        }
      }
      setAdmittingQueueId(null);
      setPrefillQueue(null);
      setActiveTab('list');
      return true;
    } catch (err) {
      alert(`Błąd podczas dodawania pacjenta. ${komunikat(err)}`);
      return false;
    }
  };

  const handleSavePatientNotes = (id: string, notes: string, originalNotes: string) => zapiszNotatki(id, notes, originalNotes);

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    try {
      const wynik = await zapiszPacjenta(updatedPatient);
      if (wynik.ostrzezenie) alert(wynik.ostrzezenie);
    } catch (err) {
      alert(`Błąd podczas aktualizacji danych. ${komunikat(err)}`);
    }
  };

  const handleDeletePatient = async (id: string) => {
    const powod = window.prompt('Usunięcie pacjenta. Rekord zostanie oznaczony jako usunięty, z Twoim kontem i datą.\n\nPodaj powód (co najmniej 5 znaków):');
    if (powod === null) return;
    if (powod.trim().length < 5) return alert('Podaj powód usunięcia (co najmniej 5 znaków).');
    try {
      await usunPacjenta(id, powod.trim());
    } catch (err) {
      alert(`Błąd podczas usuwania pacjenta. ${komunikat(err)}`);
    }
  };

  // Pełna karta pacjenta (adres, e-mail, dowód, wpłaty i usługi). Serwer zapisuje to otwarcie w dzienniku.
  const handleLoadFullPatient = (id: string) => pobierzPelnego(id);

  const handleAddPayment = async (id: string, wplata: Payment) => {
    try {
      await dodajWplate(id, wplata);
    } catch (err) {
      alert(`Błąd podczas zapisu wpłaty. ${komunikat(err)}`);
    }
  };

  // --- QUEUE CRUD ---
  const handleAddToQueue = async (queuePatient: QueuePatient) => {
    try {
      await dodajDoKolejki(queuePatient);
      alert('Dodano do kolejki.');
    } catch (err) {
      alert(`Błąd podczas dodawania do kolejki. ${komunikat(err)}`);
    }
  };

  const handleUpdateQueue = async (updated: QueuePatient) => {
    try {
      await zapiszKolejke(updated);
    } catch (err) {
      alert(`Błąd podczas aktualizacji kolejki. ${komunikat(err)}`);
    }
  };

  const handleDeleteQueue = async (id: string) => {
    const powod = window.prompt('Usunięcie wpisu z kolejki. Wpis zostanie oznaczony jako usunięty.\n\nPodaj powód (co najmniej 5 znaków):');
    if (powod === null) return;
    if (powod.trim().length < 5) return alert('Podaj powód usunięcia (co najmniej 5 znaków).');
    try {
      await usunZKolejki(id, powod.trim());
    } catch (err) {
      alert(`Błąd podczas usuwania z kolejki. ${komunikat(err)}`);
    }
  };

  // Potwierdzenie osoby w kolejce → mail powitalny + listy GetResponse (jak w obecnym CRM).
  const handleConfirmQueuePatient = async (patient: QueuePatient) => {
    try {
      // 1. Status w kolejce
      await zapiszKolejke({ ...patient, status: 'confirmed' });

      // 2. Mail powitalny + listy (jeśli jest e-mail). W ośrodku testowym wyłączone.
      if (!integracjeWlaczone()) {
        alert(`✅ ${patient.firstName} potwierdzony. Mail powitalny nie został wysłany (ośrodek testowy: maile wyłączone).`);
      } else if (isPackageWithoutMails(patient.package)) {
        alert(`✅ ${patient.firstName} potwierdzony. Dla tego rodzaju przyjazdu mail powitalny nie jest wysyłany.`);
      } else if (patient.email) {
        const result = await confirmPatientEmail({
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          package: patient.package,
          phone: patient.phone,
          startDate: patient.plannedStartDate,
          endDate: patient.plannedEndDate,
          detoksPackage: patient.detoksPackage,
        });
        if (result) {
          alert(`✅ ${patient.firstName} potwierdzony! Mail powitalny wysłany + dodany do list GetResponse.`);
        } else {
          alert(`⚠️ ${patient.firstName} potwierdzony, ale wystąpił problem z mailem/listami.`);
        }
      } else {
        alert(`✅ ${patient.firstName} potwierdzony (brak e-mail — mail nie wysłany).`);
      }
    } catch (err) {
      alert(`Błąd podczas potwierdzania. ${komunikat(err)}`);
    }
  };

  // --- WYPIS ---
  const handleDischargePatient = async (patient: Patient, dischargeData: DaneWypisu) => {
    try {
      const r = await wypisz(patient.id, dischargeData);
      const typeLabels: Record<string, string> = {
        completed: 'Zakończenie terapii',
        resignation: 'Rezygnacja z terapii',
        referral: 'Skierowanie do opieki specjalistycznej',
        conditional_break: 'Przerwa warunkowa',
        expelled: 'Wydalony',
      };
      const pokoj = r.zwolnionePrzydzialy > 0 ? ' Pokój zwolniony.' : '';

      // Mail pożegnalny TYLKO przy zakończeniu terapii (jak w obecnym CRM). E-mail jest w pełnej karcie.
      if (dischargeData.dischargeType === 'completed' && integracjeWlaczone() && !isPackageWithoutMails(patient.package)) {
        let email = '';
        try { email = (await pobierzPelnego(patient.id)).email; } catch { /* brak karty = brak maila */ }
        if (email) {
          const result = await dischargePatientEmail({ email, firstName: patient.firstName, package: patient.package });
          alert(result
            ? `✅ ${patient.firstName} wypisany (zakończenie terapii). Mail pożegnalny wysłany.${pokoj}`
            : `⚠️ ${patient.firstName} wypisany, ale problem z wysyłką maila.${pokoj}`);
          return;
        }
      }
      alert(`✅ ${patient.firstName} wypisany — ${typeLabels[dischargeData.dischargeType]}.${pokoj}`);
    } catch (err) {
      alert(`Nie udało się wypisać pacjenta. ${komunikat(err)}`);
    }
  };

  // Zmiana zapisanego wypisu: tylko powód, daty, zwrot i uwagi. Bez zmiany statusu i pokoju.
  const handleUpdateDischarge = async (patient: Patient, dischargeData: DaneWypisu) => {
    try {
      await zmienWypis(patient.id, dischargeData);
      alert(`✅ Wypis ${patient.firstName} ${patient.lastName} zaktualizowany.`);
    } catch (err) {
      alert(`Błąd podczas zapisu zmian wypisu. ${komunikat(err)}`);
    }
  };

  // Przywrócenie do aktywnych (np. powrót z przerwy warunkowej). Dane wypisu przechodzą do historii.
  const handleReactivatePatient = async (patient: Patient) => {
    if (!window.confirm(`Czy na pewno chcesz przywrócić ${patient.firstName} ${patient.lastName} do aktywnych pacjentów?`)) {
      return;
    }
    try {
      await przywroc(patient.id);
      alert(`✅ ${patient.firstName} ${patient.lastName} przywrócony do aktywnych pacjentów.`);
    } catch (err) {
      alert(`Błąd podczas przywracania pacjenta. ${komunikat(err)}`);
    }
  };

  // Przyjęcie z kolejki: pobieramy pełny wpis (PESEL, dowód, adres) i wypełniamy nim formularz.
  const handleAdmitPatient = async (queuePatient: QueuePatient) => {
    try {
      setPrefillQueue(await pobierzKarteKolejki(queuePatient.id));
      setAdmittingQueueId(queuePatient.id);
      setActiveTab('form');
    } catch (err) {
      alert(`Nie udało się otworzyć wpisu z kolejki. ${komunikat(err)}`);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Czy na pewno chcesz się wylogować?')) {
      wyloguj();
      setUser(null);
    }
  };

  // Statystyki widzi tylko grupa „statystyki” (jak dotąd STATS_ACCESS_EMAILS). Serwer pilnuje tego niezależnie.
  const canViewStats = Boolean(user?.grupy.includes('statystyki'));

  const switchTab = (tab: ActiveTab) => {
    if (tab === 'stats' && !canViewStats) {
      setError('Brak uprawnień do statystyk.');
      setActiveTab('form');
      return;
    }

    if (tab !== 'form') {
      setPrefillQueue(null);
      setAdmittingQueueId(null);
    }
    setActiveTab(tab);
  };

  const queueWaitingCount = queue.filter(q => q.status === 'waiting' || q.status === 'confirmed').length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login permissionError={permissionError} onZalogowano={(s) => { setPermissionError(null); setUser(s); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-teal-600 p-1.5 rounded-lg shrink-0"><Activity className="w-6 h-6 text-white" /></div>
              <div className="min-w-0"><h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">MyWay CRM</h1>
                <div className="flex items-center gap-1 min-w-0"><Cloud className="w-3 h-3 text-green-500 shrink-0" /><p className="text-xs text-green-700 truncate">{user.email}</p></div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleLogout} className="min-h-[44px] p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg" title="Wyloguj się" aria-label="Wyloguj się"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
            <nav aria-label="Menu główne" className="flex flex-wrap gap-1 py-2 [&_button]:min-h-[44px] [&_button]:whitespace-nowrap [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-teal-600">
              <button
                onClick={() => switchTab('form')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'form'
                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Rejestracja
              </button>
              <button
                onClick={() => switchTab('list')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'list'
                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users className="w-4 h-4" />
                Baza ({patients.length})
              </button>
              <button
                onClick={() => switchTab('queue')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'queue'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                Kolejka
                {queueWaitingCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {queueWaitingCount}
                  </span>
                )}
              </button>

              {canViewStats && (
                <button
                  onClick={() => switchTab('stats')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    activeTab === 'stats'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Statystyki
                </button>
              )}

              <button
                onClick={() => switchTab('rooms')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'rooms'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BedDouble className="w-4 h-4" />
                Pokoje
              </button>

              <button
                onClick={() => switchTab('reports')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'reports'
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                Raporty
              </button>

              <button
                onClick={() => switchTab('dziennik')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'dziennik'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Package className="w-4 h-4" />
                Dziennik
              </button>

              <button
                onClick={() => switchTab('telefony')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'telefony' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-gray-600 hover:bg-gray-100'
                }`}
              ><Phone className="w-4 h-4" />Telefony</button>
            </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Błąd: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Payment Alert — 14 days before therapy end */}
        {(() => {
          const paymentAlertDaysBefore = 14;
          const today = new Date();
          const alertWindowEnd = new Date(today.getTime() + paymentAlertDaysBefore * 24 * 60 * 60 * 1000);
          const alerts = patients.filter(p => {
            if (p.status === 'discharged' || !p.treatmentEndDate) return false;
            const endDate = new Date(p.treatmentEndDate);
            const due = getAmountDue(p);
            return due > 0 && endDate <= alertWindowEnd && endDate >= today;
          });
          if (alerts.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-800 text-sm">
                  Przypomnienie o płatnościach — terapia kończy się w ciągu {paymentAlertDaysBefore} dni
                </h3>
              </div>
              <div className="space-y-2">
                {alerts.map(p => {
                  const daysLeft = Math.ceil((new Date(p.treatmentEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                      <div>
                        <span className="font-semibold text-gray-800">{p.firstName} {p.lastName}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-sm text-gray-500">koniec: {p.treatmentEndDate}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-sm text-amber-600 font-medium">
                          {daysLeft === 0 ? 'dziś!' : daysLeft === 1 ? 'jutro!' : `za ${daysLeft} dni`}
                        </span>
                      </div>
                      <span className="text-red-600 font-bold text-sm">
                        Do zapłaty: {formatCurrency(getAmountDue(p))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {dataLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
              <p className="text-gray-500">Synchronizacja danych...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'form' && (
              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Rejestracja Pacjenta</h2>
                  <p className="text-gray-500">
                    {prefillQueue
                      ? `Dane uzupełnione z kolejki: ${prefillQueue.firstName} ${prefillQueue.lastName}. Uzupełnij brakujące pola.`
                      : 'Dane bezpiecznie zapisywane w chmurze.'
                    }
                  </p>
                  {prefillQueue && (
                    <button
                      onClick={() => { setPrefillQueue(null); setAdmittingQueueId(null); }}
                      className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
                    >
                      Anuluj wypełnianie z kolejki
                    </button>
                  )}
                </div>
                <PatientForm onSubmit={handleAddPatient} prefillFromQueue={prefillQueue || undefined} allPatients={patients} onLoadFullPatient={handleLoadFullPatient} />
              </div>
            )}

            {activeTab === 'dziennik' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Dziennik</h2>
                  <p className="text-gray-500">Zamówienia ze sklepu edu-myway.pl i kody na darmowy Dziennik. Zmiana statusu wysyła maila do klienta.</p>
                </div>
                <DziennikTab />
              </div>
            )}

            {activeTab === 'telefony' && (
              <Suspense fallback={<p role="status" className="py-10 text-center text-gray-500">Wczytywanie telefonów…</p>}>
                <TelefonyTab canStats={canViewStats} owner={user.nazwa || user.email} />
              </Suspense>
            )}

            {activeTab === 'list' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Lista Pacjentów</h2>
                    <p className="text-gray-500">Widok współdzielony przez personel.</p>
                  </div>
                  <button
                    onClick={() => switchTab('form')}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    + Dodaj nowego
                  </button>
                </div>
                <PatientList
                  patients={patients}
                  onUpdatePatient={handleUpdatePatient}
                  onSaveNotes={handleSavePatientNotes}
                  onDeletePatient={handleDeletePatient}
                  onDischargePatient={handleDischargePatient}
                  onReactivatePatient={handleReactivatePatient}
                  onUpdateDischarge={handleUpdateDischarge}
                  onLoadFullPatient={handleLoadFullPatient}
                  onAddPayment={handleAddPayment}
                />
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Kolejka oczekujących</h2>
                  <p className="text-gray-500">Osoby które wpłaciły zaliczkę i czekają na termin.</p>
                </div>

                {/* Queue Add Form */}
                <div className="mb-8">
                  <QueueForm onSubmit={handleAddToQueue} allPatients={patients} onLoadFullPatient={handleLoadFullPatient} />
                </div>

                {/* Queue List */}
                <QueueList
                  queue={queue}
                  onUpdateQueue={handleUpdateQueue}
                  onDeleteQueue={handleDeleteQueue}
                  onAdmitPatient={handleAdmitPatient}
                  onConfirmPatient={handleConfirmQueuePatient}
                  allPatients={patients}
                  onLoadFullQueue={pobierzKarteKolejki}
                  onLoadFullPatient={handleLoadFullPatient}
                />
              </div>
            )}

            {activeTab === 'stats' && canViewStats && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatsDashboard patients={patients} />
              </div>
            )}

            {activeTab === 'rooms' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <RoomsTab patients={patients} queue={queue} />
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ReportsTab patients={patients} queue={queue} canStats={canViewStats} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
