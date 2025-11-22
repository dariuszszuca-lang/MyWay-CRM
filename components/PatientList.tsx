import React, { useState } from 'react';
import { Patient, formatCurrency, getAmountDue } from '../types';
import { FileText, User, ScrollText, MessageCircle, CheckSquare, Square } from 'lucide-react';
import { generateContract, generatePatientCard, generateRegulations } from '../services/pdfGenerator';

interface PatientListProps {
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => void;
}

const PatientList: React.FC<PatientListProps> = ({ patients, onUpdatePatient }) => {
  const [filterPackage, setFilterPackage] = useState<'all' | '1' | '2' | '3'>('all');

  const filteredPatients = patients.filter(p => filterPackage === 'all' ? true : p.package === filterPackage);

  const getWhatsAppLink = (phone: string) => {
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/48${cleanNumber}`;
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Brak pacjentów w bazie. Dodaj pierwszego pacjenta.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Package Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {(['all', '1', '2', '3'] as const).map((pkg) => (
          <button
            key={pkg}
            onClick={() => setFilterPackage(pkg)}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
              filterPackage === pkg 
                ? 'bg-teal-600 text-white shadow-md' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {pkg === 'all' ? 'Wszyscy pacjenci' : `Pakiet ${pkg}`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-end">
          <button 
            onClick={() => generateRegulations()}
            className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium px-3 py-1.5 rounded hover:bg-teal-100 transition-colors"
          >
            <ScrollText className="w-4 h-4" />
            Pobierz Regulamin Ośrodka (PDF)
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
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 group">
                  {/* Pacjent / Adres */}
                  <td className="p-3 align-top">
                    <div className="font-bold text-gray-900 text-base">{patient.firstName} {patient.lastName}</div>
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
                    <div className="text-xs mt-2 pt-2 border-t border-gray-200">
                      Do zapłaty: <span className="font-mono font-bold text-red-600">{formatCurrency(getAmountDue(patient))}</span>
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
                          className="w-16 p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-black"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientList;