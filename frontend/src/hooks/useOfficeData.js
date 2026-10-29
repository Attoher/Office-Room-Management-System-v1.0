import { useEffect, useMemo, useState } from 'react';
import { subscribeDoors } from '../services/doorService';
import { subscribeElements } from '../services/elementService';
import { subscribeFloors } from '../services/floorService';
import { subscribeOffices } from '../services/officeService';
import { subscribeRooms } from '../services/roomService';

/**
 * Data kantor, lantai, ruangan, pintu, dan elemen (jendela, kolom, furnitur) secara realtime
 * dari Firestore. Semua kantor dimuat sekaligus; pemisahan per kantor dilakukan useActiveOffice.
 * status: 'loading' | 'ready' | 'error'
 */
export function useOfficeData() {
  const [rawOffices, setRawOffices] = useState(null);
  const [floors, setFloors] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [rawDoors, setRawDoors] = useState(null);
  const [rawElements, setRawElements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribes = [
      // Kantor belum terbaca (mis. rules lama): data lama tetap tampil di bawah satu kantor
      subscribeOffices(setRawOffices, (officeError) => {
        console.warn(officeError);
        setRawOffices([]);
      }),
      subscribeFloors(setFloors, setError),
      subscribeRooms(setRooms, setError),
      subscribeDoors(setRawDoors, setError),
      // Elemen hanya pelengkap gambar: bila tidak terbaca (mis. rules lama), denah tetap jalan
      subscribeElements(setRawElements, (elementError) => {
        console.warn(elementError);
        setRawElements([]);
      }),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const roomsById = useMemo(() => new Map((rooms ?? []).map((room) => [room.id, room])), [rooms]);

  // Pintu yang ruangannya sudah tidak ada disembunyikan
  const doors = useMemo(
    () => (rawDoors ?? []).filter((d) => roomsById.has(d.room_from) && roomsById.has(d.room_to)),
    [rawDoors, roomsById],
  );

  // Elemen yang menempel ke ruangan yang sudah tidak ada disembunyikan
  const elements = useMemo(
    () => (rawElements ?? []).filter((e) => e.room_id == null || roomsById.has(e.room_id)),
    [rawElements, roomsById],
  );

  // Data lama tanpa kantor: tampilkan di bawah satu kantor sementara sampai dimigrasikan
  const offices = useMemo(() => {
    if (rawOffices === null) return [];
    if (rawOffices.length > 0 || !floors?.length) return rawOffices;
    return [{ id: -1, nama: 'Kantor', alamat: '', virtual: true }];
  }, [rawOffices, floors]);

  const loaded =
    rawOffices !== null &&
    floors !== null &&
    rooms !== null &&
    rawDoors !== null &&
    rawElements !== null;
  let status = 'ready';
  if (error && !loaded) status = 'error';
  else if (!loaded) status = 'loading';

  return {
    offices,
    floors: floors ?? [],
    rooms: rooms ?? [],
    roomsById,
    doors,
    elements,
    status,
    error,
  };
}
