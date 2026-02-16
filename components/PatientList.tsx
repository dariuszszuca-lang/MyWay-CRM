import React, { useState, useMemo } from 'react';
import { Patient, formatCurrency, getAmountDue } from '../types';
import { FileText, User, ScrollText, MessageCircle, CheckSquare, Square, Pencil, Trash2, Search, Wallet, X, CheckCircle, MapPin, Calendar, CreditCard, LogOut } from 'lucide-react';
import { generateContract, generatePatientCard, generateRegulations } from '../services/pdfGenerator';
import PatientForm from './PatientForm';

interface PatientListProps {
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (id: string) => void;
  onDischargePatient: (patient: Patient) => void;
}

const PatientList: React.FC<PatientListProps> = ({ patients, onUpdatePatient, onDeletePatient, onDischargePatient }) => {
  const [filterPackage, setFilterPackage] = useState<'all' | '1' | '2' | '3'>('all');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New filters
  const [filterVoivodeship, setFilterVoivodeship] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'day' | 'week' | 'prevweek' | 'month' | '3months'>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  // State for Payment Modal
  const [paymentModalPatient, setPaymentModalPatient] = useState<Patient | null>(null);
  const [paymentAmountPaid, setPaymentAmountPaid] = useState<number>(0);

  // Get unique voivodeships from patients
  const uniqueVoivodeships = useMemo(() => {
    const voivodeships = [...new Set(patients.map(p => p.voivodeship).filter(Boolean))];
    return voivodeships.sort();
  }, [patients]);

  // Date filter helper
  const isWithinDateRange = (dateStr: string, range: string): boolean => {
    if (range === 'all' || !dateStr) return true;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    switch (range) {
      case 'day': return diffDays <= 1;
      case 'week': return diffDays <= 7;
      case 'prevweek': return diffDays > 7 && diffDays <= 14;
      case 'month': return diffDays <= 30;
      case '3months': return diffDays <= 90;
      default: return true;
    }
  };

  // Filter Logic: Package + Search + Voivodeship + Date + Payment Status
  const filteredPatients = patients.filter(p => {
    const matchesPackage = filterPackage === 'all' || p.package === filterPackage;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = p.firstName.toLowerCase().includes(searchLower) ||
                          p.lastName.toLowerCase().includes(searchLower) ||
                          p.pesel.includes(searchLower);
    const matchesVoivodeship = filterVoivodeship === 'all' || p.voivodeship === filterVoivodeship;
    const matchesDateRange = isWithinDateRange(p.applicationDate, filterDateRange);
    const amountDue = getAmountDue(p);
    const matchesPayment = filterPaymentStatus === 'all' ||
                           (filterPaymentStatus === 'paid' && amountDue <= 0) ||
                           (filterPaymentStatus === 'unpaid' && amountDue > 0);

    return matchesPackage && matchesSearch && matchesVoivodeship && matchesDateRange && matchesPayment;
  });

  // Count active filters
  const activeFiltersCount = [
    filterPackage !== 'all',
    filterVoivodeship !== 'all',
    filterDateRange !== 'all',
    filterPaymentStatus !== 'all'
  ].filter(Boolean).length;

  const getWhatsAppLink = (phone: string) => {
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/48${cleanNumber}`;
  };

  const handleSaveEdit = (updatedPatient: Patient) => {
    onUpdatePatient(updatedPatient);
    setEditingPatient(null);
  };

  // Payment Modal Handlers
  const openPaymentModal = (patient: Patient) => {
    setPaymentModalPatient(patient);
    setPaymentAmountPaid(patient.amountPaid);
  };

  const handleSavePayment = () => {
    if (paymentModalPatient) {
      onUpdatePatient({
        ...paymentModalPatient,
        amountPaid: paymentAmountPaid
      });
      setPaymentModalPatient(null);
    }
  };

  const handlePayInFull = () => {
    if (paymentModalPatient) {
      setPaymentAmountPaid(paymentModalPatient.totalAmount);
    }
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Brak pacjentów w bazie. Dodaj pierwszego pacjenta.
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Modal for Editing */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-8 animate-in fade-in zoom-in duration-200">
             <PatientForm 
                initialData={editingPatient} 
                onSubmit={handleSaveEdit} 
                onCancel={() => setEditingPatient(null)} 
             />
          </div>
        </div>
      )}

      {/* Modal for Quick Payment */}
      {paymentModalPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Rozlicz Płatność</h3>
              <button onClick={() => setPaymentModalPatient(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pacjent:</span>
                <span className="font-semibold">{paymentModalPatient.firstName} {paymentModalPatient.lastName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Całkowity koszt:</span>
                <span className="font-bold">{formatCurrency(paymentModalPatient.totalAmount)}</span>
              </div>
              <hr />
              
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Wpłacona kwota (PLN)</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={paymentAmountPaid}
                    onChange={(e) => setPaymentAmountPaid(Number(e.target.value))}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-right font-mono text-lg bg-white text-black"
                  />
                  <button 
                    onClick={handlePayInFull}
                    className="px-3 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 text-sm font-medium whitespace-nowrap"
                  >
                    Opłać całość
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mt-2">
                <span className="text-sm font-medium text-gray-600">Pozostaje do zapłaty:</span>
                <span className={`font-mono font-bold ${paymentModalPatient.totalAmount - paymentAmountPaid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(paymentModalPatient.totalAmount - paymentAmountPaid)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleSavePayment}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Zatwierdź
              </button>
              <button 
                onClick={() => setPaymentModalPatient(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar: Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">

        {/* Row 1: Search + PDF */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Szukaj pacjenta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition duration-150 ease-in-out text-black"
            />
          </div>

          {/* PDF Download Button */}
          <button
            onClick={() => generateRegulations()}
            className="hidden sm:flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium px-3 py-1.5 rounded hover:bg-teal-50 transition-colors"
          >
            <ScrollText className="w-4 h-4" />
            Regulamin (PDF)
          </button>
        </div>

        {/* Row 2: All Filters */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">

          {/* Package Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pakiet:</span>
            <div className="flex gap-1">
              {(['all', '1', '2', '3'] as const).map((pkg) => (
                <button
                  key={pkg}
                  onClick={() => setFilterPackage(pkg)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                    filterPackage === pkg
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pkg === 'all' ? 'Wszyscy' : pkg}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Płatność:
            </span>
            <div className="flex gap-1">
              {([
                { value: 'all', label: 'Wszystkie' },
                { value: 'paid', label: 'Opłacone' },
                { value: 'unpaid', label: 'Nieopłacone' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterPaymentStatus(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterPaymentStatus === item.value
                      ? item.value === 'paid' ? 'bg-green-600 text-white shadow-sm'
                        : item.value === 'unpaid' ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Okres:
            </span>
            <div className="flex gap-1 flex-wrap">
              {([
                { value: 'all', label: 'Wszystkie' },
                { value: 'day', label: 'Dziś' },
                { value: 'week', label: '7 dni' },
                { value: 'month', label: '30 dni' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterDateRange(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterDateRange === item.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Voivodeship Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Region:
            </span>
            <select
              value={filterVoivodeship}
              onChange={(e) => setFilterVoivodeship(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none ${
                filterVoivodeship !== 'all'
                  ? 'bg-purple-600 text-white shadow-sm border-purple-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-100'
              } border`}
            >
              <option value="all">Wszystkie</option>
              {uniqueVoivodeships.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Clear All Filters */}
          {activeFiltersCount > 0 && (
            <>
              <div className="hidden md:block w-px h-6 bg-gray-200"></div>
              <button
                onClick={() => {
                  setFilterPackage('all');
                  setFilterVoivodeship('all');
                  setFilterDateRange('all');
                  setFilterPaymentStatus('all');
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <X className="w-4 h-4" />
                Wyczyść
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile only header for PDF button */}
        <div className="sm:hidden p-4 bg-gray-50 border-b border-gray-200 flex justify-end">
            <button
              onClick={() => generateRegulations()}
              className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium px-3 py-1.5 rounded hover:bg-teal-100 transition-colors"
            >
              <ScrollText className="w-4 h-4" />
              Pobierz Regulamin
            </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 font-semibold text-gray-700 min-w-[200px]">Pacjent / Adres</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[150px]">Kontakt</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[140px]">Terapia / Pakiet</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[220px]">Dodatkowe</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[200px]">Uwagi</th>
                <th className="p-3 font-semibold text-gray-700 text-right min-w-[180px]">Dokumenty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 group">
                  {/* Pacjent / Adres */}
                  <td className={`p-3 align-top ${patient.status === 'discharged' ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                         <div>
                           <span className="font-bold text-gray-900 text-base">{patient.firstName} {patient.lastName}</span>
                           {patient.status === 'discharged' && (
                             <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                               <LogOut className="w-3 h-3" />
                               Wypisany
                             </span>
                           )}
                         </div>
                         <div className="flex gap-1 ml-2">
                            <button onClick={() => setEditingPatient(patient)} className="p-1 text-gray-400 hover:text-teal-600" title="Edytuj dane">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDeletePatient(patient.id)} className="p-1 text-gray-400 hover:text-red-600" title="Usuń pacjenta">
                                <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">PESEL: {patient.pesel}</div>
                    <div className="text-xs text-gray-700 mt-2 bg-gray-100 p-1.5 rounded inline-block">
                      {patient.voivodeship}<br/>
                      <span className="text-gray-500">{patient.address}</span>
                    </div>
                  </td>

                  {/* Kontakt */}
                  <td className="p-3 align-top">
                    <div className="font-medium text-gray-900 mb-1">{patient.phone}</div>
                    {patient.hasWhatsapp && (
                      <a 
                        href={getWhatsAppLink(patient.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded mb-2 border border-green-200"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    )}
                    <div className="text-xs text-gray-500 break-all">{patient.email}</div>
                  </td>

                  {/* Terapia / Pakiet */}
                  <td className="p-3 align-top">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${
                      patient.package === '3' ? 'bg-purple-100 text-purple-800' :
                      patient.package === '2' ? 'bg-blue-100 text-blue-800' :
                      'bg-teal-100 text-teal-800'
                    }`}>
                      Pakiet {patient.package}
                    </span>
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">Start:</span> {patient.treatmentStartDate}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Koniec:</span> {patient.treatmentEndDate}
                    </div>
                    <div className="text-xs mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-[10px] uppercase">Do zapłaty:</span>
                        <span className={`font-mono font-bold ${getAmountDue(patient) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(getAmountDue(patient))}
                        </span>
                      </div>
                      <button 
                        onClick={() => openPaymentModal(patient)}
                        className={`p-1.5 rounded-full transition-colors ${getAmountDue(patient) > 0 ? 'text-teal-600 hover:bg-teal-50' : 'text-gray-300 hover:bg-gray-100'}`}
                        title="Rozlicz płatność"
                      >
                        <Wallet className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                  {/* Dodatkowe (5 tydzień / WhatsApp / Konsultacje) */}
                  <td className="p-3 align-top space-y-3">
                    {/* 5 Tydzień Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer group/check">
                      <div 
                        onClick={() => onUpdatePatient({ ...patient, isWeek5: !patient.isWeek5 })}
                        className={`transition-colors ${patient.isWeek5 ? 'text-teal-600' : 'text-gray-400 group-hover/check:text-gray-600'}`}
                      >
                        {patient.isWeek5 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <span className={`text-sm ${patient.isWeek5 ? 'font-bold text-gray-900' : 'text-gray-600'}`}>5 Tydzień</span>
                    </label>

                    {/* WhatsApp Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer group/check">
                      <div 
                        onClick={() => onUpdatePatient({ ...patient, hasWhatsapp: !patient.hasWhatsapp })}
                        className={`transition-colors ${patient.hasWhatsapp ? 'text-green-600' : 'text-gray-400 group-hover/check:text-gray-600'}`}
                      >
                        {patient.hasWhatsapp ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <span className={`text-sm ${patient.hasWhatsapp ? 'font-bold text-gray-900' : 'text-gray-600'}`}>WhatsApp</span>
                    </label>

                    {/* Konsultacje Input */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Konsultacje Online</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={patient.onlineConsultations}
                          onChange={(e) => onUpdatePatient({ ...patient, onlineConsultations: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-black [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:opacity-100"
                        />
                        <span className="text-xs text-gray-500">szt.</span>
                      </div>
                    </div>
                  </td>

                  {/* Uwagi */}
                  <td className="p-3 align-top">
                    <textarea
                      value={patient.notes}
                      onChange={(e) => onUpdatePatient({ ...patient, notes: e.target.value })}
                      placeholder="Wpisz uwagi..."
                      className="w-full h-24 p-2 text-xs border border-gray-200 rounded bg-yellow-50 focus:bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none resize-none transition-colors"
                    />
                  </td>

                  {/* Dokumenty */}
                  <td className="p-3 align-top text-right space-y-2">
                    <button
                      onClick={() => generateContract(patient)}
                      className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-teal-600 text-teal-600 rounded hover:bg-teal-50 text-xs font-medium transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Umowa
                    </button>
                    <button
                      onClick={() => generatePatientCard(patient)}
                      className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-xs font-medium transition-colors"
                    >
                      <User className="w-3 h-3" />
                      Karta
                    </button>
                    {patient.status !== 'discharged' && (
                      <button
                        onClick={() => onDischargePatient(patient)}
                        className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-purple-400 text-purple-600 rounded hover:bg-purple-50 text-xs font-medium transition-colors"
                        title="Wypisz pacjenta → wysyła mail pożegnalny"
                      >
                        <LogOut className="w-3 h-3" />
                        Wypisz
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nie znaleziono pacjentów pasujących do wyszukiwania "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientList;