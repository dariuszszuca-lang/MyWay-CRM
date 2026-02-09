import React, { useState } from 'react';
import { QueuePatient, formatCurrency } from '../types';
import { UserPlus, Pencil, XCircle, Phone, Mail, Calendar, Wallet, Clock, CheckCircle, AlertCircle, Search, UserX } from 'lucide-react';
import QueueForm from './QueueForm';

interface QueueListProps {
  queue: QueuePatient[];
  onUpdateQueue: (patient: QueuePatient) => void;
  onDeleteQueue: (id: string) => void;
  onAdmitPatient: (patient: QueuePatient) => void;
}

const statusConfig = {
  waiting: { label: 'Oczekuje', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  confirmed: { label: 'Potwierdzony', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  cancelled: { label: 'Anulowany', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  noshow: { label: 'Nie przyjechał', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: UserX },
};

const QueueList: React.FC<QueueListProps> = ({ queue, onUpdateQueue, onDeleteQueue, onAdmitPatient }) => {
  const [editingPatient, setEditingPatient] = useState<QueuePatient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'waiting' | 'confirmed' | 'cancelled' | 'noshow'>('all');

  const handleSaveEdit = (updated: QueuePatient) => {
    onUpdateQueue(updated);
    setEditingPatient(null);
  };

  const handleCancel = (patient: QueuePatient) => {
    if (window.confirm(`Czy na pewno chcesz anulować kolejkę dla ${patient.firstName} ${patient.lastName}?`)) {
      onUpdateQueue({ ...patient, status: 'cancelled' });
    }
  };

  const handleDelete = (patient: QueuePatient) => {
    if (window.confirm(`Czy na pewno chcesz USUNĄĆ ${patient.firstName} ${patient.lastName} z kolejki? Tej operacji nie można cofnąć.`)) {
      onDeleteQueue(patient.id);
    }
  };

  // Filter and sort
  const filtered = queue
    .filter(p => {
      const matchesSearch = searchQuery === '' ||
        p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone.includes(searchQuery);
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // cancelled/noshow last, then by plannedStartDate
      const inactiveStatuses = ['cancelled', 'noshow'];
      const aInactive = inactiveStatuses.includes(a.status);
      const bInactive = inactiveStatuses.includes(b.status);
      if (aInactive && !bInactive) return 1;
      if (bInactive && !aInactive) return -1;
      return (a.plannedStartDate || '').localeCompare(b.plannedStartDate || '');
    });

  const waitingCount = queue.filter(p => p.status === 'waiting').length;
  const confirmedCount = queue.filter(p => p.status === 'confirmed').length;

  if (queue.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Kolejka jest pusta. Dodaj pierwszą osobę oczekującą.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edit Modal */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-8 animate-in fade-in zoom-in duration-200">
            <QueueForm
              initialData={editingPatient}
              onSubmit={handleSaveEdit}
              onCancel={() => setEditingPatient(null)}
            />
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-800">
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          Oczekuje: {waitingCount}
        </div>
        <div className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-medium text-green-800">
          <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
          Potwierdzeni: {confirmedCount}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Szukaj w kolejce..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 sm:text-sm text-black"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'waiting', 'confirmed', 'cancelled', 'noshow'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filterStatus === s
                  ? s === 'waiting' ? 'bg-amber-600 text-white' :
                    s === 'confirmed' ? 'bg-green-600 text-white' :
                    s === 'cancelled' ? 'bg-red-500 text-white' :
                    s === 'noshow' ? 'bg-orange-500 text-white' :
                    'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Wszyscy' : statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((patient) => {
          const cfg = statusConfig[patient.status];
          const StatusIcon = cfg.icon;
          const isCancelled = patient.status === 'cancelled' || patient.status === 'noshow';

          return (
            <div
              key={patient.id}
              className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md ${isCancelled ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{patient.firstName} {patient.lastName}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border mt-1 ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  patient.package === '3' ? 'bg-purple-100 text-purple-800' :
                  patient.package === '2' ? 'bg-blue-100 text-blue-800' :
                  'bg-teal-100 text-teal-800'
                }`}>
                  Pakiet {patient.package}
                </span>
              </div>

              {/* Details */}
              <div className="px-5 pb-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {patient.phone}
                </div>
                {patient.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                )}
                {(patient.plannedStartDate || patient.plannedEndDate) && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {patient.plannedStartDate || '?'} → {patient.plannedEndDate || '?'}
                  </div>
                )}
                {patient.depositAmount > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Wallet className="w-3.5 h-3.5 text-gray-400" />
                    Zaliczka: <span className="font-bold text-green-700">{formatCurrency(patient.depositAmount)}</span>
                    {patient.depositDate && <span className="text-gray-400 text-xs">({patient.depositDate})</span>}
                  </div>
                )}
                {patient.notes && (
                  <div className="flex items-start gap-2 text-gray-500 text-xs bg-gray-50 p-2 rounded mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    {patient.notes}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                {!isCancelled && (
                  <button
                    onClick={() => onAdmitPatient(patient)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Przyjmij
                  </button>
                )}
                <button
                  onClick={() => setEditingPatient(patient)}
                  className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-100 transition-colors"
                  title="Edytuj"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {!isCancelled ? (
                  <button
                    onClick={() => handleCancel(patient)}
                    className="px-3 py-2 bg-white border border-gray-200 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
                    title="Anuluj"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(patient)}
                    className="px-3 py-2 bg-white border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
                    title="Usuń na stałe"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
          Brak wyników dla wybranych filtrów.
        </div>
      )}
    </div>
  );
};

export default QueueList;
