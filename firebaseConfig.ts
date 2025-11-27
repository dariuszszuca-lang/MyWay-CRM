import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- INSTRUKCJA DLA CIEBIE ---
// Wklej tutaj dane ze strony Firebase.
// Zamień napisy "WKLEJ_TU_..." na swoje prawdziwe kody.
// Pamiętaj, żeby zostawić cudzysłowy!

const firebaseConfig = {
  apiKey: "WKLEJ_TU_API_KEY",
  authDomain: "WKLEJ_TU_AUTH_DOMAIN",
  projectId: "WKLEJ_TU_PROJECT_ID",
  storageBucket: "WKLEJ_TU_STORAGE_BUCKET",
  messagingSenderId: "WKLEJ_TU_MESSAGING_SENDER_ID",
  appId: "WKLEJ_TU_APP_ID"
};

// Inicjalizacja połączenia
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);