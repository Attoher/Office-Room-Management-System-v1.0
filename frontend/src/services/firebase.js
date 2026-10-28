import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase project: roomofficemanagement
const firebaseConfig = {
  apiKey: 'AIzaSyDsUkugpJ0wAf_BwoJnO9QRwHSioAiimhc',
  authDomain: 'roomofficemanagement.firebaseapp.com',
  projectId: 'roomofficemanagement',
  storageBucket: 'roomofficemanagement.firebasestorage.app',
  messagingSenderId: '608803656591',
  appId: '1:608803656591:web:9f13c0bfc5d3e9bbfb31fa',
  measurementId: 'G-HHBEEP6G52'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
