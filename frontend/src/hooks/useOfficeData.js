import { useEffect, useMemo, useState } from 'react';
import { subscribeDoors } from '../services/doorService';
import { subscribeElements } from '../services/elementService';
import { subscribeFloors } from '../services/floorService';
import { subscribeRooms } from '../services/roomService';

/**
 * Data lantai, ruangan, pintu, dan elemen (jendela, kolom, furnitur) secara realtime dari Firestore.
 * status: 'loading' | 'ready' | 'error'
 */
export function useOfficeData() {
  const [floors, setFloors] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [rawDoors, setRawDoors] = useState(null);
  const [rawElements, setRawElements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribes = [
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

  const loaded = floors !== null && rooms !== null && rawDoors !== null && rawElements !== null;
  let status = 'ready';
  if (error && !loaded) status = 'error';
  else if (!loaded) status = 'loading';

  return {
    floors: floors ?? [],
    rooms: rooms ?? [],
    roomsById,
    doors,
    elements,
    status,
    error,
  };
}
