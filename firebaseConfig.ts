import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- INSTRUKCJA DLA CIEBIE ---
// Wklej tutaj dane ze strony Firebase.
// Zamień napisy "WKLEJ_TU_..." na swoje prawdziwe kody.
// Pamiętaj, żeby zostawić cudzysłowy!

const firebaseConfig = {
  apiKey: "AIzaSyB_kr_85LmJEEHgG0D-NRtJsvD6i9IAuSo",
  authDomain: "myway-crm-a4593.firebaseapp.com",
  projectId: "myway-crm-a4593",
  storageBucket: "myway-crm-a4593.firebasestorage.app",
  messagingSenderId: "867189110896",
  appId: "1:867189110896:web:085d33d9d19fc1e1acdcb5"
};

// Inicjalizacja połączenia
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
