import { useEffect, useMemo, useState } from 'react';
import { subscribeConnections } from '../services/connectionService';
import { subscribeRooms } from '../services/roomService';

/**
 * Data ruangan & koneksi secara realtime dari Firestore.
 * status: 'loading' | 'ready' | 'error'
 */
export function useOfficeData() {
  const [rooms, setRooms] = useState(null);
  const [rawConnections, setRawConnections] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeRooms = subscribeRooms((data) => {
      setRooms(data);
      setError(null);
    }, setError);
    const unsubscribeConnections = subscribeConnections(setRawConnections, setError);
    return () => {
      unsubscribeRooms();
      unsubscribeConnections();
    };
  }, []);

  const roomsById = useMemo(() => new Map((rooms ?? []).map((room) => [room.id, room])), [rooms]);

  // Koneksi yang ruangannya sudah tidak ada disembunyikan, sisanya dilengkapi nama ruangan
  const connections = useMemo(
    () =>
      (rawConnections ?? [])
        .filter((c) => roomsById.has(c.room_from) && roomsById.has(c.room_to))
        .map((c) => ({
          ...c,
          from_name: roomsById.get(c.room_from).nama_ruangan,
          to_name: roomsById.get(c.room_to).nama_ruangan,
        })),
    [rawConnections, roomsById],
  );

  let status = 'ready';
  if (error && (rooms === null || rawConnections === null)) status = 'error';
  else if (rooms === null || rawConnections === null) status = 'loading';

  return { rooms: rooms ?? [], roomsById, connections, status, error };
}
