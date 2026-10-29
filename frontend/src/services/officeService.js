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

// offices/{id}: { id, nama, alamat, created_at } — satu gedung/kantor berisi beberapa lantai
const officesCol = collection(db, 'offices');
const countersRef = doc(db, 'meta', 'counters');

const clean = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

function validate({ nama, alamat }) {
  const value = { nama: clean(nama), alamat: clean(alamat) };
  if (!value.nama) throw new AppError('Nama kantor wajib diisi.');
  if (value.nama.length > 60) throw new AppError('Nama kantor maksimal 60 karakter.');
  if (value.alamat.length > 120) throw new AppError('Alamat maksimal 120 karakter.');
  return value;
}

export function subscribeOffices(onData, onError) {
  return onSnapshot(
    query(officesCol, orderBy('id')),
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => ({
          id: d.data().id,
          nama: d.data().nama,
          alamat: d.data().alamat ?? '',
        })),
      ),
    (error) => onError(toAppError(error)),
  );
}

export async function createOffice(input) {
  const value = validate(input);
  try {
    return await runTransaction(db, async (tx) => {
      const counters = await tx.get(countersRef);
      const id = (counters.data()?.offices ?? 0) + 1;
      tx.set(countersRef, { offices: id }, { merge: true });
      tx.set(doc(officesCol, String(id)), { id, ...value, created_at: serverTimestamp() });
      return id;
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateOffice(id, input) {
  const value = validate(input);
  try {
    await updateDoc(doc(officesCol, String(id)), value);
  } catch (error) {
    throw toAppError(error);
  }
}

/** Kantor hanya bisa dihapus bila sudah tidak punya lantai. */
export async function deleteOffice(office, floors) {
  if (floors.some((floor) => floor.office_id === office.id)) {
    throw new AppError(`Hapus dulu semua lantai di ${office.nama}.`);
  }
  try {
    await deleteDoc(doc(officesCol, String(office.id)));
  } catch (error) {
    throw toAppError(error);
  }
}
