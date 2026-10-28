import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { MIN_DOOR_WALL, clampDoorOffset, isVerticalType, sharedWall } from '../domain/geometry';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// doors/{from_to}: { room_from, room_to, offset, created_at }
// - satu lantai: pintu di dinding bersama, offset = jarak (m) dari awal dinding ke tengah pintu
// - beda lantai: penghubung tangga/lift, offset null
// room_from selalu ID terkecil, jadi ID dokumen menjamin satu pintu per pasangan ruangan.
const doorsCol = collection(db, 'doors');

export const doorId = (a, b) => `${Math.min(a, b)}_${Math.max(a, b)}`;

export function subscribeDoors(onData, onError) {
  return onSnapshot(
    doorsCol,
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          room_from: d.data().room_from,
          room_to: d.data().room_to,
          offset: d.data().offset ?? null,
        })),
      ),
    (error) => onError(toAppError(error)),
  );
}

/** Pintu baru di tengah dinding bersama, atau penghubung tangga/lift antar lantai. */
export async function createDoor(roomA, roomB) {
  if (roomA.id === roomB.id) throw new AppError('Pilih dua ruangan yang berbeda.');

  let offset = null;
  if (roomA.lantai_id === roomB.lantai_id) {
    const wall = sharedWall(roomA, roomB);
    if (!wall || wall.length < MIN_DOOR_WALL) {
      throw new AppError(
        `${roomA.nama_ruangan} dan ${roomB.nama_ruangan} harus berbagi dinding minimal ${MIN_DOOR_WALL} m.`,
      );
    }
    offset = clampDoorOffset(wall);
  } else if (!isVerticalType(roomA.tipe) || !isVerticalType(roomB.tipe)) {
    throw new AppError('Antar lantai hanya bisa dihubungkan lewat tangga atau lift.');
  }

  const room_from = Math.min(roomA.id, roomB.id);
  const room_to = Math.max(roomA.id, roomB.id);
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(doorsCol, doorId(room_from, room_to));
      if ((await tx.get(ref)).exists()) throw new AppError('Pintu ini sudah ada.');
      tx.set(ref, { room_from, room_to, offset, created_at: serverTimestamp() });
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function moveDoor(id, offset) {
  try {
    await updateDoc(doc(doorsCol, id), { offset: Math.round(offset * 100) / 100 });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteDoor(id) {
  try {
    await deleteDoc(doc(doorsCol, id));
  } catch (error) {
    throw toAppError(error);
  }
}
