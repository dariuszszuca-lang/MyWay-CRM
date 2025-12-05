import React, { useState, useEffect } from 'react';
import { Patient } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import Login from './components/Login';
import { Activity, Users, Download, Cloud, RefreshCw, LogOut } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

// --- KONFIGURACJA DOSTĘPU (BIAŁA LISTA) ---
// Wpisz tutaj w cudzysłowach adresy email, które mają mieć dostęp do panelu.
// Oddzielaj je przecinkami.
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
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Sprawdzanie stanu zalogowania i UPRAWNIEŃ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Sprawdź czy mail jest na liście (ignoruj wielkość liter)
        const userEmail = currentUser.email?.toLowerCase() || '';
        const isAllowed = ALLOWED_EMAILS.some(allowed => allowed.toLowerCase() === userEmail);

        if (isAllowed) {
          setUser(currentUser);
          setPermissionError(null);
        } else {
          // Użytkownik zalogowany w Google, ale nie ma go na liście -> Wyloguj i pokaż błąd
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

  // 2. Pobieranie danych z chmury (tylko gdy zalogowany i zweryfikowany)
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
      // Ignorujemy błędy uprawnień przy wylogowywaniu
      if (user) {
        setError("Problem z pobraniem danych.");
      }
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddPatient = async (patientData: Patient) => {
    try {
      const { id, ...dataToSave } = patientData;
      await addDoc(collection(db, "patients"), dataToSave);
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

  // Ekran ładowania autoryzacji (żeby nie mrugało)
  if (authLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
    );
  }

  // Jeśli nie zalogowany -> Pokaż Login
  if (!user) {
    return <Login permissionError={permissionError} />;
  }

  // Jeśli zalogowany -> Pokaż Aplikację
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
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'form' 
                    ? 'bg-teal-50 text-teal-700 border border-teal-100' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Rejestracja
              </button>
              <button 
                onClick={() => setActiveTab('list')}
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

        {dataLoading ? (
            <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                    <p className="text-gray-500">Synchronizacja danych...</p>
                </div>
            </div>
        ) : (
            <>
                {activeTab === 'form' ? (
                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Rejestracja Pacjenta</h2>
                    <p className="text-gray-500">Dane bezpiecznie zapisywane w chmurze.</p>
                    </div>
                    <PatientForm onSubmit={handleAddPatient} />
                </div>
                ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Lista Pacjentów</h2>
                        <p className="text-gray-500">Widok współdzielony przez personel.</p>
                    </div>
                    <button 
                        onClick={() => setActiveTab('form')} 
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
                    />
                </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;
