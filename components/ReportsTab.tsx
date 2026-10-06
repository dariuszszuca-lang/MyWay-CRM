import React, { useState } from 'react';
import { Patient, QueuePatient, Room, RoomAssignment } from '../types';
import { usePokoje } from '../services/roomsService';
import PatientsInResidenceReport from './PatientsInResidenceReport';
import AdmissionsReport from './AdmissionsReport';
import DischargesReport from './DischargesReport';
import SettlementsReport from './SettlementsReport';
import { Users, LogIn, LogOut, Wallet } from 'lucide-react';

interface Props {
  patients: Patient[];
  queue?: QueuePatient[];
  canStats?: boolean; // raport rozliczeń tylko dla kont ze statystykami
}

type SubTab = 'residence' | 'admissions' | 'discharges' | 'settlements';

const ReportsTab: React.FC<Props> = ({ patients, queue = [], canStats = false }) => {
  // AWS: pokoje i przydziały z API, odświeżane co 20 s i po każdej zmianie.
  const { rooms, assignments } = usePokoje();
  const [subTab, setSubTab] = useState<SubTab>('residence');

  const tabBtn = (id: SubTab, label: string, Icon: any) => (
    <button
      onClick={() => setSubTab(id)}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
        subTab === id
          ? 'bg-teal-50 text-teal-700 border border-teal-100'
          : 'text-gray-600 hover:bg-gray-100 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg shadow-sm">
        {tabBtn('residence', 'Pacjenci w ośrodku', Users)}
        {tabBtn('admissions', 'Raport przyjęć', LogIn)}
        {tabBtn('discharges', 'Raport wypisów', LogOut)}
        {canStats && tabBtn('settlements', 'Rozliczenia i psychiatra', Wallet)}
      </div>

      {subTab === 'residence' && (
        <PatientsInResidenceReport patients={patients} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'admissions' && (
        <AdmissionsReport queue={queue} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'discharges' && (
        <DischargesReport patients={patients} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'settlements' && canStats && <SettlementsReport />}
    </div>
  );
};

export default ReportsTab;
