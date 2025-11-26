import React, { useState, useEffect } from 'react';
import { Patient } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import { Activity, Users, Download, Upload, Database } from 'lucide-react';

const App: React.FC = () => {
  // Inicjalizacja stanu z LocalStorage (jeśli dane istnieją)
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('myway_patients');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');

  // Automatyczny zapis do LocalStorage przy każdej zmianie listy pacjentów
  useEffect(() => {
    localStorage.setItem('myway_patients', JSON.stringify(patients));
  }, [patients]);

  const handleAddPatient = (patient: Patient) => {
    setPatients([patient, ...patients]);
    setActiveTab('list');
  };

  const handleUpdatePatient = (updatedPatient: Patient) => {
    setPatients(patients.map(p => p.id === updatedPatient.id ? updatedPatient : p));
  };

  const handleDeletePatient = (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego pacjenta? Tej operacji nie można cofnąć.')) {
      setPatients(patients.filter(p => p.id !== id));
    }
  };

  // Funkcja eksportu bazy do pliku JSON
  const handleExport = () => {
    const dataStr = JSON.stringify(patients, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `baza_pacjentow_myway_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Funkcja importu bazy z pliku JSON
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (window.confirm('UWAGA: Importowanie bazy NADPISZE obecne dane. Czy chcesz kontynuować?')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              setPatients(parsed);
              alert('Baza została pomyślnie zaimportowana.');
            } else {
              alert('Nieprawidłowy format pliku.');
            }
          } catch (error) {
            alert('Błąd podczas importu pliku. Upewnij się, że to poprawny plik bazy danych.');
          }
        };
        reader.readAsText(file);
      }
      // Reset inputa, aby można było wybrać ten sam plik ponownie
      event.target.value = '';
    }
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
              <p className="text-xs text-gray-500">Ośrodek Leczenia Uzależnień</p>
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
                <span className="hidden sm:inline">Eksportuj</span>
              </button>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors cursor-pointer" title="Wgraj kopię zapasową">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importuj</span>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
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
        {activeTab === 'form' ? (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Rejestracja Pacjenta</h2>
              <p className="text-gray-500">Wprowadź dane, aby wygenerować umowę i kartę pacjenta.</p>
            </div>
            <PatientForm onSubmit={handleAddPatient} />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Lista Pacjentów</h2>
                <p className="text-gray-500">Zarządzaj dokumentacją i monitoruj postępy.</p>
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
      </main>
    </div>
  );
};

export default App;