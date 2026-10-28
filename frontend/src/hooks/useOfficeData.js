import { useEffect, useMemo, useState } from 'react';
import { subscribeDoors } from '../services/doorService';
import { subscribeFloors } from '../services/floorService';
import { subscribeRooms } from '../services/roomService';

/**
 * Data lantai, ruangan, dan pintu secara realtime dari Firestore.
 * status: 'loading' | 'ready' | 'error'
 */
export function useOfficeData() {
  const [floors, setFloors] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [rawDoors, setRawDoors] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribes = [
      subscribeFloors(setFloors, setError),
      subscribeRooms(setRooms, setError),
      subscribeDoors(setRawDoors, setError),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const roomsById = useMemo(() => new Map((rooms ?? []).map((room) => [room.id, room])), [rooms]);

  // Pintu yang ruangannya sudah tidak ada disembunyikan
  const doors = useMemo(
    () => (rawDoors ?? []).filter((d) => roomsById.has(d.room_from) && roomsById.has(d.room_to)),
    [rawDoors, roomsById],
  );

  const loaded = floors !== null && rooms !== null && rawDoors !== null;
  let status = 'ready';
  if (error && !loaded) status = 'error';
  else if (!loaded) status = 'loading';

  return {
    floors: floors ?? [],
    rooms: rooms ?? [],
    roomsById,
    doors,
    status,
    error,
  };
}
