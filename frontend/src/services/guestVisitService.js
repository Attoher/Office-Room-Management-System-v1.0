import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { validateGuest } from '../domain/guestVisit';
import { db } from './firebase';
import { AppError, toAppError } from './errors';

// guest_visits/{auto}: { nama, instansi, office_id, asal_id, asal_nama, tujuan_id, tujuan_nama,
//                        jarak (meter, null bila tidak ada jalur), jalur (ID ruangan yang dilewati),
//                        status, created_at }
const visitsCol = collection(db, 'guest_visits');

function fromSnapshot(d) {
  // 'estimate': kunjungan yang baru dicatat langsung tampil sebelum waktu server diterima
  const data = d.data({ serverTimestamps: 'estimate' });
  return {
    id: d.id,
    nama: data.nama,
    instansi: data.instansi,
    office_id: data.office_id,
    asal_id: data.asal_id,
    asal_nama: data.asal_nama,
    tujuan_id: data.tujuan_id,
    tujuan_nama: data.tujuan_nama,
    jarak: data.jarak ?? null,
    // Catatan lama belum menyimpan jalur; dihitung ulang saat ditampilkan
    jalur: Array.isArray(data.jalur) ? data.jalur : null,
    status: data.status,
    created_at: data.created_at?.toDate() ?? null,
  };
}

/**
 * Kunjungan sejak `since` (dan sebelum `until` bila diisi), terbaru dulu. Hanya memakai filter
 * created_at supaya tidak perlu indeks gabungan; pemisahan per kantor dilakukan di aplikasi.
 */
export function subscribeGuestVisits({ since, until }, onData, onError) {
  const filters = [where('created_at', '>=', Timestamp.fromDate(since))];
  if (until) filters.push(where('created_at', '<', Timestamp.fromDate(until)));
  return onSnapshot(
    query(visitsCol, ...filters, orderBy('created_at', 'desc')),
    (snapshot) => onData(snapshot.docs.map(fromSnapshot)),
    (error) => onError(toAppError(error)),
  );
}

/** Catat tamu beserta jalur yang ditunjukkan kepadanya. */
export async function recordGuestVisit({ guest, officeId, start, target, plan, route }) {
  const { value, errors } = validateGuest(guest);
  if (Object.keys(errors).length > 0) {
    throw new AppError(Object.values(errors)[0], { fieldErrors: errors });
  }
  if (!start || !target) throw new AppError('Pilih ruangan asal dan tujuan terlebih dahulu.');
  try {
    await addDoc(visitsCol, {
      ...value,
      office_id: officeId,
      asal_id: start.id,
      asal_nama: start.nama_ruangan,
      tujuan_id: target.id,
      tujuan_nama: target.nama_ruangan,
      jarak: route ? Math.round(route.length * 10) / 10 : null,
      ...(route && { jalur: route.roomIds }),
      status: plan.status,
      created_at: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Khusus admin Back Office (dicek firestore.rules). */
export async function deleteGuestVisit(id) {
  try {
    await deleteDoc(doc(visitsCol, id));
  } catch (error) {
    throw toAppError(error);
  }
}
