import React, { useState, useEffect } from 'react';
import { Patient } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import { Activity, Users, Download, Upload, Cloud, RefreshCw } from 'lucide-react';
import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pobieranie danych z chmury w czasie rzeczywistym
  useEffect(() => {
    setLoading(true);
    // Nasłuchuj zmian w kolekcji "patients"
    const q = query(collection(db, "patients"), orderBy("lastName"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientsData: Patient[] = snapshot.docs.map(doc => ({
        ...doc.data() as Omit<Patient, 'id'>,
        id: doc.id // Nadpisujemy ID tym z bazy danych
      }));
      setPatients(patientsData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Błąd połączenia z bazą:", err);
      setError("Nie można połączyć się z bazą danych. Sprawdź plik firebaseConfig.ts");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddPatient = async (patientData: Patient) => {
    try {
      // Usuwamy sztuczne ID generowane przez formularz, baza nada własne
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
      // Destrukturyzacja, żeby nie zapisywać ID wewnątrz dokumentu (jest ono w nazwie dokumentu)
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

  // Eksport bazy (nadal przydatne jako kopia lokalna)
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
                <p className="text-xs text-green-600 font-medium">Baza Online</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
             {/* Database Controls */}
            <div className="flex items-center gap-2 mr-2 md:border-r md:pr-4 border-gray-200">
               <button 
                onClick={handleExport}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
                title="Pobierz kopię zapasową bazy danych na dysk"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Pobierz Kopię</span>
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
                Baza Pacjentów ({patients.length})
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Błąd konfiguracji! </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {loading ? (
            <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                    <p className="text-gray-500">Łączenie z bazą danych...</p>
                </div>
            </div>
        ) : (
            <>
                {activeTab === 'form' ? (
                <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Rejestracja Pacjenta</h2>
                    <p className="text-gray-500">Dane zostaną zapisane w chmurze i będą widoczne dla wszystkich.</p>
                    </div>
                    <PatientForm onSubmit={handleAddPatient} />
                </div>
                ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Lista Pacjentów</h2>
                        <p className="text-gray-500">Synchronizacja w czasie rzeczywistym.</p>
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