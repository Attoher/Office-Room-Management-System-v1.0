import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// Konfigurasi web app Firebase (project roomofficemanagement). Nilai ini memang publik;
// keamanan data diatur oleh firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDsUkugpJ0wAf_BwoJnO9QRwHSioAiimhc',
  authDomain: 'roomofficemanagement.firebaseapp.com',
  projectId: 'roomofficemanagement',
  storageBucket: 'roomofficemanagement.firebasestorage.app',
  messagingSenderId: '608803656591',
  appId: '1:608803656591:web:9f13c0bfc5d3e9bbfb31fa',
  measurementId: 'G-HHBEEP6G52',
};

export const db = getFirestore(initializeApp(firebaseConfig));

// Untuk pengujian lokal: VITE_FIRESTORE_EMULATOR=127.0.0.1:8080 mengarahkan ke Firestore emulator
const emulator = import.meta.env.VITE_FIRESTORE_EMULATOR;
if (emulator) {
  const [host, port] = emulator.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
