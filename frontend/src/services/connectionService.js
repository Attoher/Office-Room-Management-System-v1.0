import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// connections/{from_to}: { room_from, room_to, created_at }
// room_from selalu ID terkecil, jadi ID dokumen sekaligus menjamin satu koneksi per pasangan.
const connectionsCol = collection(db, 'connections');

export const connectionId = (a, b) => `${Math.min(a, b)}_${Math.max(a, b)}`;

export function subscribeConnections(onData, onError) {
  return onSnapshot(
    connectionsCol,
    (snapshot) =>
      onData(
        snapshot.docs
          .map((d) => ({ id: d.id, room_from: d.data().room_from, room_to: d.data().room_to }))
          .sort((a, b) => a.room_from - b.room_from || a.room_to - b.room_to),
      ),
    (error) => onError(toAppError(error)),
  );
}

export async function createConnection(roomA, roomB) {
  if (!roomA || !roomB) throw new AppError('Pilih dua ruangan.');
  if (roomA === roomB) throw new AppError('Ruangan tidak boleh dihubungkan ke dirinya sendiri.');

  const room_from = Math.min(roomA, roomB);
  const room_to = Math.max(roomA, roomB);

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(connectionsCol, connectionId(room_from, room_to));
      const [existing, from, to] = await Promise.all([
        tx.get(ref),
        tx.get(doc(db, 'rooms', String(room_from))),
        tx.get(doc(db, 'rooms', String(room_to))),
      ]);
      if (existing.exists()) throw new AppError('Kedua ruangan sudah terhubung.');
      if (!from.exists() || !to.exists()) throw new AppError('Ruangan sudah tidak ada.');
      tx.set(ref, { room_from, room_to, created_at: serverTimestamp() });
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteConnection(id) {
  try {
    await deleteDoc(doc(connectionsCol, id));
  } catch (error) {
    throw toAppError(error);
  }
}
