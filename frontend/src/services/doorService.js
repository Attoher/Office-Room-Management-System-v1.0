import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  MIN_DOOR_WALL,
  doorPlacementError,
  findFreeDoorOffset,
  isVerticalType,
  sharedWall,
} from '../domain/geometry';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// doors/{id}: { room_from, room_to, offset, swing_into, hinge, created_at }
// - satu lantai: pintu di dinding bersama; boleh lebih dari satu pintu per pasangan ruangan.
//   offset = jarak (m) dari awal dinding ke tengah pintu, swing_into = ruangan tempat daun
//   pintu membuka, hinge = 'start' | 'end' (engsel di ujung awal/akhir celah pintu)
// - beda lantai: penghubung tangga/lift (offset, swing_into, hinge null), satu per pasangan
// room_from selalu ID terkecil.
const doorsCol = collection(db, 'doors');

export const isSamePair = (door, a, b) =>
  (door.room_from === a && door.room_to === b) || (door.room_from === b && door.room_to === a);

export function subscribeDoors(onData, onError) {
  return onSnapshot(
    doorsCol,
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            room_from: data.room_from,
            room_to: data.room_to,
            offset: data.offset ?? null,
            swing_into: data.swing_into ?? null,
            hinge: data.hinge ?? 'start',
          };
        }),
      ),
    (error) => onError(toAppError(error)),
  );
}

/**
 * Pintu baru antara dua ruangan. Satu lantai: ditempatkan di posisi kosong terdekat dari tengah
 * dinding bersama. Beda lantai: penghubung tangga/lift.
 */
export async function createDoor(roomA, roomB, doors, roomsById) {
  if (roomA.id === roomB.id) throw new AppError('Pilih dua ruangan yang berbeda.');
  const room_from = Math.min(roomA.id, roomB.id);
  const room_to = Math.max(roomA.id, roomB.id);
  let data;

  if (roomA.lantai_id === roomB.lantai_id) {
    const wall = sharedWall(roomA, roomB);
    if (!wall || wall.length < MIN_DOOR_WALL) {
      throw new AppError(
        `${roomA.nama_ruangan} dan ${roomB.nama_ruangan} harus berbagi dinding minimal ${MIN_DOOR_WALL} m.`,
      );
    }
    const draft = { room_from, room_to, swing_into: room_to, hinge: 'start' };
    const offset = findFreeDoorOffset(draft, doors, roomsById);
    if (offset === null) {
      throw new AppError('Tidak ada tempat kosong untuk pintu baru di dinding ini.');
    }
    data = { ...draft, offset };
  } else {
    if (!isVerticalType(roomA.tipe) || !isVerticalType(roomB.tipe)) {
      throw new AppError('Antar lantai hanya bisa dihubungkan lewat tangga atau lift.');
    }
    if (doors.some((d) => isSamePair(d, room_from, room_to))) {
      throw new AppError('Kedua ruangan ini sudah terhubung.');
    }
    data = { room_from, room_to, offset: null, swing_into: null, hinge: null };
  }

  try {
    const ref = doc(doorsCol);
    await setDoc(ref, { ...data, created_at: serverTimestamp() });
    return { id: ref.id, ...data };
  } catch (error) {
    throw toAppError(error);
  }
}

/** Ubah posisi / arah buka / engsel pintu, setelah dicek tidak bertabrakan dengan pintu lain. */
export async function updateDoor(door, changes, doors, roomsById) {
  const next = { ...door, ...changes };
  if (next.offset !== null) next.offset = Math.round(next.offset * 100) / 100;
  const error = doorPlacementError(next, doors, roomsById);
  if (error) throw new AppError(error);
  try {
    await updateDoc(doc(doorsCol, door.id), {
      offset: next.offset,
      swing_into: next.swing_into ?? next.room_to,
      hinge: next.hinge ?? 'start',
    });
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
