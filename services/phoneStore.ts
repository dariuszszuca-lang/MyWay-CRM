import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { canAccessStats } from "./accessControl.ts";
import { validateContact, validateCall } from "../functions/telephony/core.mjs";
import type { PhoneContact, PhoneCall } from "./telephony.ts";

export async function savePhoneContactIn(
  db: Firestore,
  user: { uid: string; email?: string | null } | null,
  contact: PhoneContact,
  call: PhoneCall | null,
  amount: number | null | undefined,
) {
  if (!user) throw new Error("Zaloguj się ponownie.");
  const errors = [
    ...validateContact(contact),
    ...(call ? validateCall({ ...call, firstDate: contact.firstDate }) : []),
  ];
  if (
    amount !== undefined &&
    (!canAccessStats(user.email) ||
      (amount !== null &&
        (!Number.isFinite(amount) || amount < 0 || amount > 10000000)))
  )
    errors.push("Nieprawidłowa kwota lub brak dostępu do finansów.");
  if (call?.kind === "Pierwszy kontakt" && contact.revision > 0)
    errors.push("Ten kontakt już istnieje. Wybierz kolejną rozmowę.");
  if (
    call?.kind === "Pierwszy kontakt" &&
    (call.date !== contact.firstDate || call.time !== contact.firstTime)
  )
    errors.push("Pierwsza rozmowa musi być zgodna z datą i godziną kontaktu.");
  if (errors.length) throw new Error(errors.join(" "));
  const ref = contact.id
    ? doc(db, "phoneContacts", contact.id)
    : doc(collection(db, "phoneContacts"));
  const callRef = call ? doc(collection(db, "phoneCalls")) : null;
  const auditRef = doc(db, "phoneAudit", `${ref.id}_${contact.revision + 1}`);
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    const financeRef = doc(db, "phoneFinancials", ref.id);
    const oldFinance = amount !== undefined ? await tx.get(financeRef) : null;
    if (current.exists() && current.data().revision !== contact.revision)
      throw new Error(
        "Ktoś zmienił ten kontakt. Zamknij formularz i otwórz go ponownie.",
      );
    if (!current.exists() && contact.revision > 0)
      throw new Error("Kontakt nie istnieje. Odśwież listę.");
    const { id, updatedAt, createdAt, updatedBy, createdBy, ...fields } =
      contact;
    const revision = contact.revision + 1;
    const data = {
      ...fields,
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      ...(!current.exists()
        ? { createdAt: serverTimestamp(), createdBy: user.uid }
        : {}),
    };
    tx.set(ref, data, { merge: true });
    if (call && callRef) {
      const { id, ...c } = call;
      tx.set(callRef, {
        ...c,
        contactId: ref.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
    }
    if (amount !== undefined) {
      tx.set(financeRef, {
        amount,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(db, "phoneFinancialAudit", `${ref.id}_${revision}`), {
        contactId: ref.id,
        before: oldFinance?.exists() ? oldFinance.data().amount : null,
        after: amount,
        revision,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
    }
    tx.set(auditRef, {
      contactId: ref.id,
      revision,
      action: call ? "Rozmowa" : "Edycja kontaktu",
      before: current.exists() ? current.data() : null,
      after: fields,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  });
  return ref.id;
}
