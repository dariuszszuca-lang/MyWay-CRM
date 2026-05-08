import React, { useEffect, useState } from 'react';
import { Patient, QueuePatient, Room, RoomAssignment } from '../types';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import RoomsManagement from './RoomsManagement';
import RoomAssignmentManager from './RoomAssignmentManager';
import RoomTimelineReport from './RoomTimelineReport';
import RoomAvailabilityReport from './RoomAvailabilityReport';
import AdmissionsReport from './AdmissionsReport';
import DischargesReport from './DischargesReport';
import { Settings, UserCheck, CalendarDays, ListChecks, LogIn, LogOut } from 'lucide-react';

interface Props {
  patients: Patient[];
  queue?: QueuePatient[];
}

type SubTab = 'assignments' | 'timeline' | 'availability' | 'admissions' | 'discharges' | 'manage';

const RoomsTab: React.FC<Props> = ({ patients, queue = [] }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('assignments');

  useEffect(() => {
    const qRooms = query(collection(db, 'rooms'));
    const unsubRooms = onSnapshot(qRooms, snap => {
      setRooms(snap.docs.map(d => ({ ...(d.data() as Omit<Room, 'id'>), id: d.id })));
    });
    return () => unsubRooms();
  }, []);

  useEffect(() => {
    const qA = query(collection(db, 'roomAssignments'), orderBy('createdAt', 'desc'));
    const unsubA = onSnapshot(qA, snap => {
      setAssignments(snap.docs.map(d => ({ ...(d.data() as Omit<RoomAssignment, 'id'>), id: d.id })));
    });
    return () => unsubA();
  }, []);

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
        {tabBtn('admissions', 'Raport przyjęć', LogIn)}
        {tabBtn('discharges', 'Raport wypisów', LogOut)}
        {tabBtn('manage', 'Zarządzanie pokojami', Settings)}
      </div>

      {subTab === 'assignments' && (
        <RoomAssignmentManager patients={patients} rooms={rooms} assignments={assignments} queue={queue} />
      )}
      {subTab === 'availability' && (
        <RoomAvailabilityReport patients={patients} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'timeline' && (
        <RoomTimelineReport patients={patients} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'admissions' && (
        <AdmissionsReport queue={queue} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'discharges' && (
        <DischargesReport patients={patients} rooms={rooms} assignments={assignments} />
      )}
      {subTab === 'manage' && (
        <RoomsManagement rooms={rooms} assignments={assignments} />
      )}
    </div>
  );
};

export default RoomsTab;
