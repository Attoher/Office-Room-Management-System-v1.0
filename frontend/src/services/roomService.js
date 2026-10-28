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
import { geometryError, snapToGrid } from '../domain/geometry';
import { roomArea, toNameKey, validateRoomInput } from '../domain/roomValidation';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// rooms/{id}: { id, nama_ruangan, nama_key, tipe, lantai_id, x, y, w, h, luas,
//               kapasitas_max, occupancy, created_at, updated_at }
// Posisi & ukuran dalam meter; luas selalu w × h.
// meta/counters: { rooms, floors } — ID numerik terakhir yang dipakai
const roomsCol = collection(db, 'rooms');
const doorsCol = collection(db, 'doors');
const countersRef = doc(db, 'meta', 'counters');
const roomRef = (id) => doc(roomsCol, String(id));

const toRoom = (snapshot) => {
  const d = snapshot.data();
  return {
    id: d.id,
    nama_ruangan: d.nama_ruangan,
    tipe: d.tipe,
    lantai_id: d.lantai_id,
    x: d.x,
    y: d.y,
    w: d.w,
    h: d.h,
    luas: d.luas,
    kapasitas_max: d.kapasitas_max,
    occupancy: d.occupancy,
  };
};

export function subscribeRooms(onData, onError) {
  return onSnapshot(
    query(roomsCol, orderBy('id')),
    (snapshot) => onData(snapshot.docs.map(toRoom)),
    (error) => onError(toAppError(error)),
  );
}

function validateInfo(input, options) {
  const { value, errors } = validateRoomInput(input, options);
  if (Object.keys(errors).length > 0) {
    throw new AppError('Periksa kembali isian ruangan.', { fieldErrors: errors });
  }
  return value;
}

function validateGeometry(rect, allRooms) {
  const snapped = {
    id: rect.id,
    lantai_id: rect.lantai_id,
    x: snapToGrid(rect.x),
    y: snapToGrid(rect.y),
    w: snapToGrid(rect.w),
    h: snapToGrid(rect.h),
  };
  const error = geometryError(snapped, allRooms);
  if (error) throw new AppError(error);
  return snapped;
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

/** Buat ruangan baru dari informasi + kotak di denah ({ lantai_id, x, y, w, h }). */
export async function createRoom(info, rect, allRooms) {
  try {
    const value = validateInfo(info);
    const geometry = validateGeometry(rect, allRooms);
    await assertNameAvailable(value.nama_ruangan);

    return await runTransaction(db, async (tx) => {
      const counters = await tx.get(countersRef);
      const id = (counters.data()?.rooms ?? 0) + 1;
      tx.set(countersRef, { rooms: id }, { merge: true });
      tx.set(roomRef(id), {
        ...value,
        nama_key: toNameKey(value.nama_ruangan),
        ...geometry,
        // id ditulis setelah geometry, yang membawa id: undefined untuk ruangan baru
        id,
        luas: roomArea(geometry),
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

export async function updateRoomInfo(room, info) {
  try {
    const value = validateInfo(info, { currentOccupancy: room.occupancy });
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

/** Pindah/ubah ukuran ruangan. Pintu yang dindingnya hilang tetap tersimpan tapi tidak aktif. */
export async function updateRoomGeometry(room, rect, allRooms) {
  try {
    const geometry = validateGeometry(
      { ...rect, id: room.id, lantai_id: room.lantai_id },
      allRooms,
    );
    await updateDoc(roomRef(room.id), {
      x: geometry.x,
      y: geometry.y,
      w: geometry.w,
      h: geometry.h,
      luas: roomArea(geometry),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Hapus ruangan beserta semua pintunya dalam satu batch. */
export async function deleteRoom(roomId) {
  try {
    const [from, to] = await Promise.all([
      getDocs(query(doorsCol, where('room_from', '==', roomId))),
      getDocs(query(doorsCol, where('room_to', '==', roomId))),
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
