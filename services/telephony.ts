import { savePhoneContactIn } from "./phoneStore";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { auth } from "../firebaseConfig";
import { canAccessStats } from "./accessControl";
import { validateContact, validateCall } from "../functions/telephony/core.mjs";
export * from "../functions/telephony/core.mjs";

export interface PhoneContact {
  id: string;
  label: string;
  phone: string;
  firstDate: string;
  firstTime: string;
  category: string;
  quality: string;
  temperature: string;
  source: string;
  stage: string;
  province: string;
  status: string;
  closedDate: string;
  lossReason: string;
  nextDate: string;
  nextTime: string;
  followupStatus: string;
  note: string;
  followupNote: string;
  owner: string;
  revision: number;
  historical?: boolean;
  followupConfirmed?: boolean;
  historicalCount?: string;
  historicalDuration?: string;
  updatedBy?: string;
  updatedAt?: any;
  createdBy?: string;
  createdAt?: any;
}
export interface PhoneCall {
  id: string;
  contactId: string;
  date: string;
  time: string;
  kind: string;
  durationSeconds: number | null;
  result: string;
  answered: boolean;
  fullConversation: boolean;
  callback: boolean;
  note: string;
  createdBy?: string;
  createdAt?: any;
}
export interface PhoneFinancial {
  id: string;
  amount: number | null;
}
export interface PhoneReport {
  id: string;
  kind: string;
  from: string;
  to: string;
  summary: any;
  filters: Record<string, string>;
  generatedAt: string;
  automatic: boolean;
}
export type PhoneFilters = {
  source?: string;
  owner?: string;
  category?: string;
  quality?: string;
  kind?: string;
};
export function watchPhoneCollection<T>(
  name: string,
  next: (v: T[]) => void,
  error: () => void,
) {
  return onSnapshot(
    collection(db, name),
    (s) => next(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
    () => error(),
  );
}
export async function savePhoneContact(
  contact: PhoneContact,
  call: PhoneCall | null,
  amount: number | null | undefined,
) {
  return savePhoneContactIn(db, auth.currentUser, contact, call, amount);
}
export async function savePhoneReport(report: Omit<PhoneReport, "id">) {
  if (!canAccessStats(auth.currentUser?.email))
    throw new Error("Brak dostępu do raportów.");
  await addDoc(collection(db, "phoneReports"), {
    ...report,
    createdBy: auth.currentUser!.uid,
    createdAt: serverTimestamp(),
  });
}
