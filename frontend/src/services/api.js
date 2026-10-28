import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  where,
  limit,
  runTransaction,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { buildGraph, computePath } from './pathfinding';

// Data disimpan di Cloud Firestore:
//   rooms/{id}        { id, nama_ruangan, luas, kapasitas_max, occupancy, created_at, updated_at }
//   connections/{id}  { id, room_from, room_to, created_at }  (room_from selalu ID terkecil)
//   meta/counters     { rooms, connections }  -> penghitung ID numerik (pengganti SERIAL)
const roomsCol = collection(db, 'rooms');
const connectionsCol = collection(db, 'connections');
const countersRef = doc(db, 'meta', 'counters');

// Bentuk error sama seperti versi axios sebelumnya: { status, message, details }
const apiError = (status, message, details) => ({ status, message, details });

const toApiError = (error) => {
  if (error && typeof error.status === 'number' && error.message) return error;
  console.error('❌ Firestore Error:', error);
  return apiError(0, 'Database Error: ' + (error?.message || 'Unknown error'),
    'Please check your internet connection and Firestore rules');
};

const run = async (label, fn) => {
  console.log(`🚀 ${label}`);
  try {
    const result = await fn();
    console.log(`✅ ${label}`);
    return result;
  } catch (error) {
    throw toApiError(error);
  }
};

const now = () => new Date().toISOString();

const fetchRooms = async () => {
  const snap = await getDocs(roomsCol);
  return snap.docs.map(d => d.data()).sort((a, b) => a.id - b.id);
};

const fetchConnections = async () => {
  const snap = await getDocs(connectionsCol);
  return snap.docs.map(d => d.data()).sort((a, b) => a.id - b.id);
};

const withRoomNames = (connections, rooms) => connections.map(conn => ({
  ...conn,
  from_name: rooms.find(r => r.id === conn.room_from)?.nama_ruangan ?? null,
  to_name: rooms.find(r => r.id === conn.room_to)?.nama_ruangan ?? null
}));

const getRoomOrThrow = async (id) => {
  const snap = await getDoc(doc(roomsCol, String(id)));
  if (!snap.exists()) throw apiError(404, 'Room not found');
  return snap.data();
};

// Validasi (dipindahkan dari backend/utils/validation.js)
const sanitizeRoom = (roomData) => {
  const errors = [];
  const nama_ruangan = (roomData.nama_ruangan || '').trim();
  const luas = parseFloat(roomData.luas);
  const kapasitas_max = parseInt(roomData.kapasitas_max);
  const occupancy = parseInt(roomData.occupancy) || 0;

  if (!nama_ruangan) errors.push('Nama ruangan harus diisi');
  if (!(luas > 0)) errors.push('Luas ruangan harus lebih dari 0');
  if (!(kapasitas_max > 0)) errors.push('Kapasitas maksimal harus lebih dari 0');
  if (occupancy < 0) errors.push('Occupancy tidak boleh negatif');

  if (errors.length > 0) throw apiError(400, 'Validation failed', errors);
  return { nama_ruangan, luas, kapasitas_max, occupancy };
};

const assertUniqueName = async (nama_ruangan, exceptId) => {
  const snap = await getDocs(query(roomsCol, where('nama_ruangan', '==', nama_ruangan), limit(2)));
  if (snap.docs.some(d => d.data().id !== exceptId)) {
    throw apiError(400, 'Room name already exists');
  }
};

// Ambil ID berikutnya dan tulis dokumen baru dalam satu transaksi
const createWithNextId = (counterKey, colRef, buildData) =>
  runTransaction(db, async (tx) => {
    const counters = await tx.get(countersRef);
    const id = (counters.exists() ? counters.data()[counterKey] || 0 : 0) + 1;
    const data = { id, ...buildData() };
    tx.set(countersRef, { [counterKey]: id }, { merge: true });
    tx.set(doc(colRef, String(id)), data);
    return data;
  });

const statusOf = (room) => {
  const percent = (room.occupancy / room.kapasitas_max) * 100;
  return percent < 70 ? 'hijau' : percent < 90 ? 'kuning' : 'merah';
};

// Test API connection
export const testAPI = {
  health: () => apiUtils.checkConnection(),
  dbTest: () => apiUtils.testDatabase(),
};

export const roomsAPI = {
  getAll: () => run('GET rooms', fetchRooms),

  getById: (id) => run(`GET rooms/${id}`, () => getRoomOrThrow(parseInt(id))),

  create: (roomData) => run('POST rooms', async () => {
    const data = sanitizeRoom(roomData);
    await assertUniqueName(data.nama_ruangan);
    const timestamp = now();
    return createWithNextId('rooms', roomsCol, () => ({ ...data, created_at: timestamp, updated_at: timestamp }));
  }),

  update: (id, roomData) => run(`PUT rooms/${id}`, async () => {
    const roomId = parseInt(id);
    const existing = await getRoomOrThrow(roomId);
    const data = sanitizeRoom(roomData);
    await assertUniqueName(data.nama_ruangan, roomId);
    const updated = { ...existing, ...data, updated_at: now() };
    await updateDoc(doc(roomsCol, String(roomId)), { ...data, updated_at: updated.updated_at });
    return updated;
  }),

  // Hapus ruangan beserta semua koneksinya
  delete: (id) => run(`DELETE rooms/${id}`, async () => {
    const roomId = parseInt(id);
    const existing = await getRoomOrThrow(roomId);
    const [fromSnap, toSnap] = await Promise.all([
      getDocs(query(connectionsCol, where('room_from', '==', roomId))),
      getDocs(query(connectionsCol, where('room_to', '==', roomId)))
    ]);
    const batch = writeBatch(db);
    [...fromSnap.docs, ...toSnap.docs].forEach(d => batch.delete(d.ref));
    batch.delete(doc(roomsCol, String(roomId)));
    await batch.commit();
    return existing;
  }),

  updateOccupancy: (id, occupancy) => run(`PUT rooms/${id}/occupancy`, async () => {
    const roomId = parseInt(id);
    const room = await getRoomOrThrow(roomId);
    const occupancyValue = parseInt(occupancy);

    if (isNaN(occupancyValue)) throw apiError(400, 'Occupancy harus berupa angka');
    if (occupancyValue > room.kapasitas_max) {
      throw apiError(400, `Occupancy cannot exceed maximum capacity of ${room.kapasitas_max}`);
    }
    if (occupancyValue < 0) throw apiError(400, 'Occupancy cannot be negative');

    const updated = { ...room, occupancy: occupancyValue, updated_at: now() };
    await updateDoc(doc(roomsCol, String(roomId)), { occupancy: occupancyValue, updated_at: updated.updated_at });

    const percentage = (updated.occupancy / updated.kapasitas_max) * 100;
    return {
      ...updated,
      occupancy_percentage: `${percentage.toFixed(1)}%`,
      status: statusOf(updated)
    };
  }),

  getStats: () => run('GET rooms/stats', async () => {
    const rooms = await fetchRooms();
    const byStatus = (status) => rooms.filter(r => statusOf(r) === status);
    return {
      total_rooms: rooms.length,
      total_capacity: rooms.reduce((sum, room) => sum + room.kapasitas_max, 0),
      total_occupancy: rooms.reduce((sum, room) => sum + room.occupancy, 0),
      average_occupancy: rooms.length > 0 ?
        (rooms.reduce((sum, room) => sum + (room.occupancy / room.kapasitas_max), 0) / rooms.length * 100).toFixed(1) + '%' : '0%',
      status_breakdown: {
        hijau: byStatus('hijau').length,
        kuning: byStatus('kuning').length,
        merah: byStatus('merah').length
      },
      rooms_by_status: {
        hijau: byStatus('hijau').map(r => ({ id: r.id, name: r.nama_ruangan })),
        kuning: byStatus('kuning').map(r => ({ id: r.id, name: r.nama_ruangan })),
        merah: byStatus('merah').map(r => ({ id: r.id, name: r.nama_ruangan }))
      }
    };
  })
};

export const connectionsAPI = {
  // Get all connections with room names
  getAll: () => run('GET connections', async () => {
    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    return withRoomNames(connections, rooms);
  }),

  create: (connectionData) => run('POST connections', async () => {
    const room_from = parseInt(connectionData.room_from);
    const room_to = parseInt(connectionData.room_to);

    if (!room_from || !room_to) throw apiError(400, 'Validation failed', ['room_from dan room_to harus diisi']);
    if (room_from === room_to) throw apiError(400, 'Validation failed', ['room_from dan room_to tidak boleh sama']);

    // Normalize connection direction - always store smaller ID as from, larger as to
    const actualFrom = Math.min(room_from, room_to);
    const actualTo = Math.max(room_from, room_to);

    const rooms = await fetchRooms();
    const missingRooms = [actualFrom, actualTo].filter(id => !rooms.some(r => r.id === id));
    if (missingRooms.length > 0) {
      throw apiError(404,
        `Ruangan dengan ID ${missingRooms.join(', ')} tidak ditemukan. ` +
        `Ruangan yang tersedia: ${rooms.map(r => `${r.nama_ruangan} (ID: ${r.id})`).join(', ')}`);
    }

    const existing = await getDocs(query(connectionsCol,
      where('room_from', '==', actualFrom), where('room_to', '==', actualTo), limit(1)));
    if (!existing.empty) throw apiError(400, 'Koneksi sudah ada antara kedua ruangan');

    const created = await createWithNextId('connections', connectionsCol,
      () => ({ room_from: actualFrom, room_to: actualTo, created_at: now() }));
    return withRoomNames([created], rooms)[0];
  }),

  delete: (id) => run(`DELETE connections/${id}`, async () => {
    const ref = doc(connectionsCol, String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw apiError(404, 'Koneksi tidak ditemukan');
    await deleteDoc(ref);
    return snap.data();
  }),

  getRoomConnections: (roomId) => run(`GET connections/room/${roomId}`, async () => {
    const id = parseInt(roomId);
    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    return withRoomNames(connections.filter(c => c.room_from === id || c.room_to === id), rooms)
      .map(c => ({ ...c, direction: c.room_from === id ? 'outgoing' : 'incoming' }));
  }),

  debug: () => run('GET connections/debug', async () => {
    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    const joined = withRoomNames(connections, rooms);
    return {
      rooms,
      connections,
      joined_connections: joined,
      summary: {
        total_rooms: rooms.length,
        total_connections: connections.length,
        rooms_without_connections: rooms
          .filter(room => !connections.some(c => c.room_from === room.id || c.room_to === room.id))
          .map(r => ({ id: r.id, name: r.nama_ruangan }))
      }
    };
  })
};

export const pathfindingAPI = {
  findPath: (tujuan, start = 1) => run('POST pathfinding', async () => {
    console.log('🗺️ Pathfinding Request:', { start, tujuan });
    const target = (tujuan || '').trim();
    if (!target) throw apiError(400, 'Validation failed', ['Tujuan harus diisi']);

    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    try {
      return computePath(rooms, connections, target, parseInt(start) || 1);
    } catch (error) {
      throw apiError(error.status || 500, error.message);
    }
  }),

  health: () => run('GET pathfinding/health', async () => {
    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    return {
      service: 'Pathfinding',
      status: 'operational',
      rooms_count: rooms.length,
      connections_count: connections.length,
      timestamp: now(),
      algorithm: 'Enhanced DFS with efficiency scoring',
      max_paths: 10,
      max_depth: 8
    };
  }),

  getGraph: () => run('GET pathfinding/graph', async () => {
    const [rooms, connections] = await Promise.all([fetchRooms(), fetchConnections()]);
    const adjacency = buildGraph(rooms, connections);
    const graph = {};
    rooms.forEach(room => {
      graph[room.id] = { name: room.nama_ruangan, neighbors: adjacency[room.id] };
    });
    return {
      nodes: rooms.map(r => ({ id: r.id, nama_ruangan: r.nama_ruangan })),
      edges: connections,
      graph_structure: graph,
      summary: {
        total_nodes: rooms.length,
        total_edges: connections.length,
        average_connectivity: rooms.length ? (connections.length * 2 / rooms.length).toFixed(2) : '0.00'
      }
    };
  }),

  legacy: (tujuan, start = 1) => pathfindingAPI.findPath(tujuan, start)
};

export const apiUtils = {
  // Check if Firestore is reachable
  checkConnection: async () => {
    try {
      await getDocsFromServer(query(roomsCol, limit(1)));
      return { connected: true, status: 'OK', environment: 'firebase' };
    } catch (error) {
      console.error('❌ Firestore connection failed:', error);
      return { connected: false, error: error.message };
    }
  },

  testDatabase: () => run('GET db-test', async () => {
    await getDocsFromServer(query(roomsCol, limit(1)));
    return {
      status: 'success',
      message: 'Database connected successfully',
      database: { name: db.app.options.projectId, type: 'Cloud Firestore', time: now() }
    };
  })
};

export default {
  testAPI,
  roomsAPI,
  connectionsAPI,
  pathfindingAPI,
  apiUtils
};
