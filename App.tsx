import React, { useState } from 'react';
import { Patient } from './types';
import PatientForm from './components/PatientForm';
import PatientList from './components/PatientList';
import { Activity, Users } from 'lucide-react';

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-teal-600 p-1.5 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">MyWay CRM</h1>
              <p className="text-xs text-gray-500">Ośrodek Leczenia Uzależnień</p>
            </div>
          </div>
          
          <nav className="flex gap-2">
            <button 
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'form' 
                  ? 'bg-teal-50 text-teal-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rejestracja
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'list' 
                  ? 'bg-teal-50 text-teal-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Baza Pacjentów ({patients.length})
            </button>
          </nav>
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
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Lista Pacjentów</h2>
                <p className="text-gray-500">Zarządzaj dokumentacją i monitoruj postępy.</p>
              </div>
              <button 
                onClick={() => setActiveTab('form')} 
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              >
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