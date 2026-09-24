// Only selected by phone-preview.config.ts. This file cannot connect to production.
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
} from "firebase/auth";
const app = initializeApp({
  apiKey: "demo-test-key",
  projectId: "demo-myway-telefony",
  authDomain: "localhost",
});
export const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8185);
export const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9195", { disableWarnings: true });
export const googleProvider = new GoogleAuthProvider();
