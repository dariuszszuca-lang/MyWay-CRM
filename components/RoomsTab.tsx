import React, { useState } from 'react';
import { Patient, QueuePatient, Room, RoomAssignment } from '../types';
import { usePokoje } from '../services/roomsService';
import RoomsManagement from './RoomsManagement';
import RoomAssignmentManager from './RoomAssignmentManager';
import RoomTimelineReport from './RoomTimelineReport';
import RoomAvailabilityReport from './RoomAvailabilityReport';
import { Settings, UserCheck, CalendarDays, ListChecks } from 'lucide-react';

interface Props {
  patients: Patient[];
  queue?: QueuePatient[];
}

type SubTab = 'assignments' | 'timeline' | 'availability' | 'manage';

const RoomsTab: React.FC<Props> = ({ patients, queue = [] }) => {
  // AWS: pokoje i przydziały z API, odświeżane co 20 s i po każdej zmianie.
  const { rooms, assignments } = usePokoje();
  const [subTab, setSubTab] = useState<SubTab>('assignments');

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
        {tabBtn('assignments', 'Przypisania', UserCheck)}
        {tabBtn('availability', 'Wolne pokoje', ListChecks)}
        {tabBtn('timeline', 'Plan tygodnia', CalendarDays)}
        {tabBtn('manage', 'Zarządzanie pokojami', Settings)}
      </div>

      {subTab === 'assignments' && (
        <RoomAssignmentManager patients={patients} rooms={rooms} assignments={assignments} queue={queue} />
      )}
      {subTab === 'availability' && (
        <RoomAvailabilityReport patients={patients} rooms={rooms} assignments={assignments} queue={queue} />
      )}
      {subTab === 'timeline' && (
        <RoomTimelineReport patients={patients} rooms={rooms} assignments={assignments} queue={queue} />
      )}
      {subTab === 'manage' && (
        <RoomsManagement rooms={rooms} assignments={assignments} patients={patients} queue={queue} />
      )}
    </div>
  );
};

export default RoomsTab;
