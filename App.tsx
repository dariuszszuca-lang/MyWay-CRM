import React, { useState, useEffect } from 'react';
import { Patient, QueuePatient, getAmountDue, formatCurrency } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import QueueForm from './components/QueueForm';
import QueueList from './components/QueueList';
import Login from './components/Login';
import StatsDashboard from './components/StatsDashboard';
import { Activity, Users, Download, Cloud, RefreshCw, LogOut, Clock, BarChart3, AlertTriangle } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { sendWelcomeEmail, confirmPatientEmail, dischargePatientEmail } from './services/getResponseService';

// --- KONFIGURACJA DOSTĘPU (BIAŁA LISTA) ---
const ALLOWED_EMAILS = [
  "dariusz.szuca@gmail.com",
  "krystiannagaba@gmail.com",
  "mywaymarcin@gmail.com",
  "npucz708@gmail.com",
  "gabinet.osrodekmyway@gmail.com",
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'queue' | 'stats'>('form');
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from queue → form
  const [prefillQueue, setPrefillQueue] = useState<QueuePatient | null>(null);
  const [admittingQueueId, setAdmittingQueueId] = useState<string | null>(null);

  // 1. Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userEmail = currentUser.email?.toLowerCase() || '';
        const isAllowed = ALLOWED_EMAILS.some(allowed => allowed.toLowerCase() === userEmail);
        if (isAllowed) {
          setUser(currentUser);
          setPermissionError(null);
        } else {
          signOut(auth);
          setUser(null);
          setPermissionError(`Brak dostępu dla adresu: ${userEmail}. Skontaktuj się z administratorem.`);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load patients from Firebase
  useEffect(() => {
    if (!user) {
      setPatients([]);
      return;
    }

    setDataLoading(true);
    const q = query(collection(db, "patients"), orderBy("lastName"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientsData: Patient[] = snapshot.docs.map(doc => ({
        ...doc.data() as Omit<Patient, 'id'>,
        id: doc.id
      }));
      setPatients(patientsData);
      setDataLoading(false);
      setError(null);
    }, (err) => {
      console.error("Błąd połączenia z bazą:", err);
      if (user) {
        setError("Problem z pobraniem danych.");
      }
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Load queue from Firebase
  useEffect(() => {
    if (!user) {
      setQueue([]);
      return;
    }

    const q = query(collection(db, "queue"), orderBy("createdAt"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queueData: QueuePatient[] = snapshot.docs.map(doc => ({
        ...doc.data() as Omit<QueuePatient, 'id'>,
        id: doc.id
      }));
      setQueue(queueData);
    }, (err) => {
      console.error("Błąd kolejki:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // --- PATIENT CRUD ---
  const handleAddPatient = async (patientData: Patient) => {
    try {
      const { id, ...dataToSave } = patientData;
      const docRef = await addDoc(collection(db, "patients"), dataToSave);

      // Notify
      try {
        await fetch('https://europe-west1-myway-point-app.cloudfunctions.net/notifyNewPatient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            email: patientData.email,
            phone: patientData.phone,
            package: patientData.package
          })
        });
      } catch (notifyError) {
        console.warn('⚠️ Nie udało się wysłać powiadomienia:', notifyError);
      }

      // GetResponse welcome email
      const emailSent = await sendWelcomeEmail({
        email: patientData.email,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        package: patientData.package,
        phone: patientData.phone
      });
      if (!emailSent) {
        console.warn('⚠️ Nie udało się dodać pacjenta do GetResponse');
      }

      // Package 3 → MyWayPoint sync
      if (patientData.package === '3') {
        try {
          const response = await fetch(
            'https://europe-west1-myway-point-app.cloudfunctions.net/createPatientFromCRM',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                email: patientData.email,
                phone: patientData.phone,
                totalSessions: 20,
                crmPatientId: docRef.id
              })
            }
          );
          if (!response.ok) {
            console.error('MyWayPoint sync error:', await response.text());
          }
        } catch (syncError) {
          console.error('MyWayPoint sync failed:', syncError);
        }
      }

      // If admitting from queue, remove from queue
      if (admittingQueueId) {
        try {
          await deleteDoc(doc(db, "queue", admittingQueueId));
        } catch (err) {
          console.warn('Nie udało się usunąć z kolejki:', err);
        }
        setAdmittingQueueId(null);
        setPrefillQueue(null);
      }

      setActiveTab('list');
    } catch (err) {
      alert("Błąd podczas dodawania pacjenta do chmury.");
      console.error(err);
    }
  };

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    try {
      const patientRef = doc(db, "patients", updatedPatient.id);
      const { id, ...dataToUpdate } = updatedPatient;
      await updateDoc(patientRef, dataToUpdate);
    } catch (err) {
      alert("Błąd podczas aktualizacji danych.");
      console.error(err);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego pacjenta? Tej operacji nie można cofnąć.')) {
      try {
        await deleteDoc(doc(db, "patients", id));
      } catch (err) {
        alert("Błąd podczas usuwania pacjenta.");
        console.error(err);
      }
    }
  };

  // --- QUEUE CRUD ---
  // Firestore nie akceptuje undefined w polach — usuń je przed zapisem
  const stripUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    const out: Partial<T> = {};
    for (const key in obj) {
      if (obj[key] !== undefined) out[key] = obj[key];
    }
    return out;
  };

  const handleAddToQueue = async (queuePatient: QueuePatient) => {
    try {
      const { id, ...dataToSave } = queuePatient;
      await addDoc(collection(db, "queue"), stripUndefined(dataToSave));
      alert("Dodano do kolejki.");
    } catch (err) {
      alert("Błąd podczas dodawania do kolejki.");
      console.error(err);
    }
  };

  const handleUpdateQueue = async (updated: QueuePatient) => {
    try {
      const ref = doc(db, "queue", updated.id);
      const { id, ...dataToUpdate } = updated;
      await updateDoc(ref, stripUndefined(dataToUpdate));
    } catch (err) {
      alert("Błąd podczas aktualizacji kolejki.");
      console.error(err);
    }
  };

  const handleDeleteQueue = async (id: string) => {
    try {
      await deleteDoc(doc(db, "queue", id));
    } catch (err) {
      alert("Błąd podczas usuwania z kolejki.");
      console.error(err);
    }
  };

  // Confirm patient in queue → send welcome email + add to GetResponse lists
  const handleConfirmQueuePatient = async (patient: QueuePatient) => {
    try {
      // 1. Update status in Firestore
      const ref = doc(db, "queue", patient.id);
      await updateDoc(ref, { status: 'confirmed' });

      // 2. Send welcome email + add to lists (if email exists)
      if (patient.email) {
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
      alert("Błąd podczas potwierdzania pacjenta.");
      console.error(err);
    }
  };

  // Discharge patient → update status + optional farewell email
  const handleDischargePatient = async (patient: Patient, dischargeData: {
    dischargeType: 'completed' | 'resignation' | 'referral' | 'conditional_break' | 'expelled';
    dischargeDate: string;
    refundAmount?: number;
    refundDate?: string;
    conditionalReturnDate?: string;
    dischargeNotes?: string;
    authorizedBy?: 'Natalia' | 'Krystian';
    authorizedNote?: string;
  }) => {
    try {
      // 1. Build update payload
      const updatePayload: Record<string, any> = {
        status: 'discharged',
        dischargeType: dischargeData.dischargeType,
        dischargeDate: dischargeData.dischargeDate,
      };
      if (dischargeData.refundAmount !== undefined && dischargeData.refundAmount > 0) {
        updatePayload.refundAmount = dischargeData.refundAmount;
      }
      if (dischargeData.refundDate) {
        updatePayload.refundDate = dischargeData.refundDate;
      }
      if (dischargeData.conditionalReturnDate) {
        updatePayload.conditionalReturnDate = dischargeData.conditionalReturnDate;
      }
      if (dischargeData.dischargeNotes) {
        updatePayload.dischargeNotes = dischargeData.dischargeNotes;
      }
      if (dischargeData.authorizedBy) {
        updatePayload.dischargeAuthorizedBy = dischargeData.authorizedBy;
      }
      if (dischargeData.authorizedNote) {
        updatePayload.dischargeAuthorizedNote = dischargeData.authorizedNote;
      }

      // 2. Update Firestore
      const patientRef = doc(db, "patients", patient.id);
      await updateDoc(patientRef, updatePayload);

      // 3. Send farewell email ONLY for completed therapy
      if (dischargeData.dischargeType === 'completed' && patient.email) {
        const result = await dischargePatientEmail({
          email: patient.email,
          firstName: patient.firstName,
          package: patient.package,
        });
        if (result) {
          alert(`✅ ${patient.firstName} wypisany (zakończenie terapii). Mail pożegnalny wysłany.`);
        } else {
          alert(`⚠️ ${patient.firstName} wypisany, ale problem z wysyłką maila.`);
        }
      } else {
        const typeLabels: Record<string, string> = {
          completed: 'Zakończenie terapii',
          resignation: 'Rezygnacja z terapii',
          referral: 'Skierowanie do opieki specjalistycznej',
          conditional_break: 'Przerwa warunkowa',
          expelled: 'Wydalony',
        };
        alert(`✅ ${patient.firstName} wypisany — ${typeLabels[dischargeData.dischargeType]}.`);
      }
    } catch (err) {
      alert("Błąd podczas wypisywania pacjenta.");
      console.error(err);
    }
  };

  // Reactivate patient (e.g. return from conditional break)
  const handleReactivatePatient = async (patient: Patient) => {
    if (!window.confirm(`Czy na pewno chcesz przywrócić ${patient.firstName} ${patient.lastName} do aktywnych pacjentów?`)) {
      return;
    }
    try {
      const patientRef = doc(db, "patients", patient.id);
      await updateDoc(patientRef, {
        status: 'active',
        dischargeType: null,
        dischargeDate: null,
        refundAmount: null,
        refundDate: null,
        conditionalReturnDate: null,
        dischargeNotes: null,
      });
      alert(`✅ ${patient.firstName} ${patient.lastName} przywrócony do aktywnych pacjentów.`);
    } catch (err) {
      alert("Błąd podczas przywracania pacjenta.");
      console.error(err);
    }
  };

  // Admit patient: queue → form with prefill
  const handleAdmitPatient = (queuePatient: QueuePatient) => {
    setPrefillQueue(queuePatient);
    setAdmittingQueueId(queuePatient.id);
    setActiveTab('form');
  };

  // Export
  const handleExport = () => {
    const dataStr = JSON.stringify(patients, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kopia_bazy_myway_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    if(window.confirm("Czy na pewno chcesz się wylogować?")) {
      signOut(auth);
    }
  };

  // Cancel prefill when switching away from form
  const switchTab = (tab: 'form' | 'list' | 'queue' | 'stats') => {
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
    return <Login permissionError={permissionError} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-auto py-3 md:h-16 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-teal-600 p-1.5 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">MyWay CRM</h1>
              <div className="flex items-center gap-1">
                <Cloud className="w-3 h-3 text-green-500" />
                <p className="text-xs text-green-600 font-medium">Online: {user.email}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {/* Database Controls */}
            <div className="flex items-center gap-2 mr-2 md:border-r md:pr-4 border-gray-200">
              <button
                onClick={handleExport}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
                title="Pobierz kopię zapasową bazy danych"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Kopia</span>
              </button>
            </div>

            <nav className="flex gap-2">
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

              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                title="Wyloguj się"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </nav>
          </div>
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

        {/* Payment Alert — 7 days before therapy end */}
        {(() => {
          const today = new Date();
          const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          const alerts = patients.filter(p => {
            if (p.status === 'discharged' || !p.treatmentEndDate) return false;
            const endDate = new Date(p.treatmentEndDate);
            const due = getAmountDue(p);
            return due > 0 && endDate <= in7days && endDate >= today;
          });
          if (alerts.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-800 text-sm">
                  Przypomnienie o płatnościach — terapia kończy się w ciągu 7 dni
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
                <PatientForm onSubmit={handleAddPatient} prefillFromQueue={prefillQueue || undefined} allPatients={patients} />
              </div>
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
                  onDeletePatient={handleDeletePatient}
                  onDischargePatient={handleDischargePatient}
                  onReactivatePatient={handleReactivatePatient}
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
                  <QueueForm onSubmit={handleAddToQueue} allPatients={patients} />
                </div>

                {/* Queue List */}
                <QueueList
                  queue={queue}
                  onUpdateQueue={handleUpdateQueue}
                  onDeleteQueue={handleDeleteQueue}
                  onAdmitPatient={handleAdmitPatient}
                  onConfirmPatient={handleConfirmQueuePatient}
                  allPatients={patients}
                />
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatsDashboard patients={patients} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
