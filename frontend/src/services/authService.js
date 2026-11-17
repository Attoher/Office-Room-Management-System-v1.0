import {
  browserLocalPersistence,
  connectAuthEmulator,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { app } from './firebase';
import { AppError } from './errors';

// Satu akun admin Back Office di Firebase Authentication (Email/Password), sama seperti dashboard
// pemilihan konsep. Pengguna cukup mengetik sandinya; firestore.rules memakai email yang sama.
export const ADMIN_EMAIL = 'admin@room-office-management.app';

// Sesi admin diingat browser sampai keluar. Hanya dimuat saat halaman Back Office dibuka.
const auth = initializeAuth(app, { persistence: browserLocalPersistence });

// Untuk pengujian lokal: VITE_AUTH_EMULATOR=http://127.0.0.1:9099
const emulator = import.meta.env.VITE_AUTH_EMULATOR;
if (emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });

/** onChange(true/false): apakah admin sedang masuk. */
export function subscribeAdmin(onChange) {
  return onAuthStateChanged(auth, (user) => onChange(user?.email === ADMIN_EMAIL));
}

const WRONG_PASSWORD = [
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found',
  'auth/missing-password',
];

export async function signInAdmin(password) {
  if (!password) throw new AppError('Sandi wajib diisi.');
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  } catch (error) {
    console.error(error);
    if (WRONG_PASSWORD.includes(error.code)) throw new AppError('Sandi salah.');
    if (error.code === 'auth/too-many-requests') {
      throw new AppError('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    }
    if (
      error.code === 'auth/operation-not-allowed' ||
      error.code === 'auth/configuration-not-found'
    ) {
      throw new AppError('Login Email/Password belum diaktifkan di Firebase Authentication.');
    }
    throw new AppError('Tidak bisa masuk. Periksa koneksi internet Anda.');
  }
}

export function signOutAdmin() {
  return signOut(auth);
}
