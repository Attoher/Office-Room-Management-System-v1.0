import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// floors/{id}: { id, nama, created_at } — urutan lantai mengikuti id
const floorsCol = collection(db, 'floors');
const countersRef = doc(db, 'meta', 'counters');

function validName(nama) {
  const value = String(nama ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!value) throw new AppError('Nama lantai wajib diisi.');
  if (value.length > 40) throw new AppError('Nama lantai maksimal 40 karakter.');
  return value;
}

export function subscribeFloors(onData, onError) {
  return onSnapshot(
    query(floorsCol, orderBy('id')),
    (snapshot) => onData(snapshot.docs.map((d) => ({ id: d.data().id, nama: d.data().nama }))),
    (error) => onError(toAppError(error)),
  );
}

export async function createFloor(nama) {
  const value = validName(nama);
  try {
    return await runTransaction(db, async (tx) => {
      const counters = await tx.get(countersRef);
      const id = (counters.data()?.floors ?? 0) + 1;
      tx.set(countersRef, { floors: id }, { merge: true });
      tx.set(doc(floorsCol, String(id)), { id, nama: value, created_at: serverTimestamp() });
      return id;
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function renameFloor(id, nama) {
  const value = validName(nama);
  try {
    await updateDoc(doc(floorsCol, String(id)), { nama: value });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Lantai hanya bisa dihapus bila sudah tidak berisi ruangan. */
export async function deleteFloor(floor, rooms) {
  if (rooms.some((room) => room.lantai_id === floor.id)) {
    throw new AppError(`Kosongkan dulu semua ruangan di ${floor.nama}.`);
  }
  try {
    await deleteDoc(doc(floorsCol, String(floor.id)));
  } catch (error) {
    throw toAppError(error);
  }
}
