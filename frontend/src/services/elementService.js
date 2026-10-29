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
  COLUMN_DEFAULT_SIZE,
  FURNITURE,
  WINDOW_DEFAULT_WIDTH,
  findFurnitureSpot,
  furnitureError,
  snapElement,
  windowPlacementError,
} from '../domain/elements';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// elements/{id}: elemen gambar selain ruangan & pintu
//   jendela : { jenis, lantai_id, room_id, sisi, offset, lebar }
//   kolom   : { jenis, lantai_id, x, y, w, h }
//   furnitur: { jenis, lantai_id, room_id, model, x, y, rotasi }  (x, y relatif ruangan)
const elementsCol = collection(db, 'elements');
const round2 = (value) => Math.round(value * 100) / 100;

export function subscribeElements(onData, onError) {
  return onSnapshot(
    elementsCol,
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => {
          const { created_at: _created, ...data } = d.data();
          return { id: d.id, ...data };
        }),
      ),
    (error) => onError(toAppError(error)),
  );
}

async function create(data) {
  try {
    const ref = doc(elementsCol);
    await setDoc(ref, { ...data, created_at: serverTimestamp() });
    return { id: ref.id, ...data };
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createWindow(room, sisi, { elements, doors, roomsById }) {
  const data = {
    jenis: 'jendela',
    lantai_id: room.lantai_id,
    room_id: room.id,
    sisi,
    offset: null,
    lebar: WINDOW_DEFAULT_WIDTH,
  };
  const error = windowPlacementError(data, room, elements, doors, roomsById);
  if (error) throw new AppError(error);
  return create(data);
}

export async function createColumn(lantai_id, center) {
  const size = COLUMN_DEFAULT_SIZE;
  return create({
    jenis: 'kolom',
    lantai_id,
    x: round2(snapElement(center.x - size / 2)),
    y: round2(snapElement(center.y - size / 2)),
    w: size,
    h: size,
  });
}

export async function createFurniture(room, model, elements) {
  if (!FURNITURE[model]) throw new AppError('Jenis furnitur tidak dikenal.');
  const draft = {
    jenis: 'furnitur',
    lantai_id: room.lantai_id,
    room_id: room.id,
    model,
    rotasi: 0,
  };
  const spot = findFurnitureSpot(draft, room, elements);
  if (!spot)
    throw new AppError(`Tidak ada tempat kosong untuk ${FURNITURE[model].label} di ruangan ini.`);
  return create({ ...draft, ...spot });
}

/**
 * Ubah elemen setelah divalidasi sesuai jenisnya. `ctx` = { rooms by id, elements, doors }.
 */
export async function updateElement(element, changes, { roomsById, elements, doors }) {
  const next = { ...element, ...changes };
  if (next.jenis === 'jendela') {
    const room = roomsById.get(next.room_id);
    const error = windowPlacementError(next, room, elements, doors, roomsById);
    if (error) throw new AppError(error);
  } else if (next.jenis === 'furnitur') {
    const error = furnitureError(next, roomsById.get(next.room_id));
    if (error) throw new AppError(error);
  } else if (next.jenis === 'kolom' && (next.w < 0.1 || next.h < 0.1 || next.w > 3 || next.h > 3)) {
    throw new AppError('Ukuran kolom antara 0,1 dan 3 m.');
  }

  const { id: _id, ...data } = next;
  for (const key of ['x', 'y', 'w', 'h', 'offset', 'lebar']) {
    if (typeof data[key] === 'number') data[key] = round2(data[key]);
  }
  try {
    await updateDoc(doc(elementsCol, element.id), data);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteElement(id) {
  try {
    await deleteDoc(doc(elementsCol, id));
  } catch (error) {
    throw toAppError(error);
  }
}
