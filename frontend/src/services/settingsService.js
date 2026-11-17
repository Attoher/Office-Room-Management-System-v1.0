import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEFAULT_STATUS_RULES, validateStatusRules } from '../domain/occupancy';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// settings/occupancy: { kuning, merah, updated_at } — batas persen status ruangan (semua kantor)
const rulesRef = doc(db, 'settings', 'occupancy');

/** Aturan status realtime. Bila dokumen belum ada atau rusak, pakai nilai bawaan. */
export function subscribeStatusRules(onData, onError) {
  return onSnapshot(
    rulesRef,
    (snapshot) => {
      const { value, errors } = validateStatusRules(snapshot.data() ?? {});
      onData(snapshot.exists() && Object.keys(errors).length === 0 ? value : DEFAULT_STATUS_RULES);
    },
    (error) => onError(toAppError(error)),
  );
}

/** Khusus admin Back Office (dicek firestore.rules). */
export async function saveStatusRules(input) {
  const { value, errors } = validateStatusRules(input);
  if (Object.keys(errors).length > 0) {
    throw new AppError(Object.values(errors)[0], { fieldErrors: errors });
  }
  try {
    await setDoc(rulesRef, { ...value, updated_at: serverTimestamp() });
  } catch (error) {
    throw toAppError(error);
  }
}
