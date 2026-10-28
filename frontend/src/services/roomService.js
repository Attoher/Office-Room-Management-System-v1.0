import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { toNameKey, validateRoomInput } from '../domain/roomValidation';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// rooms/{id}: { id, nama_ruangan, nama_key, luas, kapasitas_max, occupancy, created_at, updated_at }
// meta/counters: { rooms } — ID numerik terakhir yang dipakai
const roomsCol = collection(db, 'rooms');
const connectionsCol = collection(db, 'connections');
const countersRef = doc(db, 'meta', 'counters');
const roomRef = (id) => doc(roomsCol, String(id));

const toRoom = (snapshot) => {
  const { id, nama_ruangan, luas, kapasitas_max, occupancy } = snapshot.data();
  return { id, nama_ruangan, luas, kapasitas_max, occupancy };
};

export function subscribeRooms(onData, onError) {
  return onSnapshot(
    query(roomsCol, orderBy('id')),
    (snapshot) => onData(snapshot.docs.map(toRoom)),
    (error) => onError(toAppError(error)),
  );
}

function validateOrThrow(input, options) {
  const { value, errors } = validateRoomInput(input, options);
  if (Object.keys(errors).length > 0) {
    throw new AppError('Periksa kembali isian ruangan.', { fieldErrors: errors });
  }
  return value;
}

async function assertNameAvailable(nama_ruangan, exceptId) {
  const snapshot = await getDocs(
    query(roomsCol, where('nama_key', '==', toNameKey(nama_ruangan)), limit(2)),
  );
  if (snapshot.docs.some((d) => d.data().id !== exceptId)) {
    throw new AppError('Nama ruangan sudah dipakai.', {
      fieldErrors: { nama_ruangan: 'Nama ruangan sudah dipakai' },
    });
  }
}

export async function createRoom(input) {
  try {
    const value = validateOrThrow(input);
    await assertNameAvailable(value.nama_ruangan);

    return await runTransaction(db, async (tx) => {
      const counters = await tx.get(countersRef);
      const id = (counters.data()?.rooms ?? 0) + 1;
      tx.set(countersRef, { rooms: id }, { merge: true });
      tx.set(roomRef(id), {
        id,
        ...value,
        nama_key: toNameKey(value.nama_ruangan),
        occupancy: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return id;
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateRoom(room, input) {
  try {
    const value = validateOrThrow(input, { currentOccupancy: room.occupancy });
    await assertNameAvailable(value.nama_ruangan, room.id);
    await updateDoc(roomRef(room.id), {
      ...value,
      nama_key: toNameKey(value.nama_ruangan),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Hapus ruangan beserta semua koneksinya dalam satu batch. */
export async function deleteRoom(roomId) {
  try {
    const [from, to] = await Promise.all([
      getDocs(query(connectionsCol, where('room_from', '==', roomId))),
      getDocs(query(connectionsCol, where('room_to', '==', roomId))),
    ]);
    const batch = writeBatch(db);
    [...from.docs, ...to.docs].forEach((d) => batch.delete(d.ref));
    batch.delete(roomRef(roomId));
    await batch.commit();
  } catch (error) {
    throw toAppError(error);
  }
}

export async function setOccupancy(room, occupancy) {
  if (!Number.isInteger(occupancy) || occupancy < 0 || occupancy > room.kapasitas_max) {
    throw new AppError(`Jumlah orang harus antara 0 dan ${room.kapasitas_max}.`);
  }
  try {
    await updateDoc(roomRef(room.id), { occupancy, updated_at: serverTimestamp() });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Tambah/kurangi occupancy secara atomik; batas 0..kapasitas dijaga juga oleh rules. */
export async function changeOccupancy(room, delta) {
  const next = room.occupancy + delta;
  if (next < 0 || next > room.kapasitas_max) return;
  try {
    await updateDoc(roomRef(room.id), {
      occupancy: increment(delta),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function resetAllOccupancy(rooms) {
  try {
    const batch = writeBatch(db);
    rooms
      .filter((room) => room.occupancy > 0)
      .forEach((room) =>
        batch.update(roomRef(room.id), { occupancy: 0, updated_at: serverTimestamp() }),
      );
    await batch.commit();
  } catch (error) {
    throw toAppError(error);
  }
}
