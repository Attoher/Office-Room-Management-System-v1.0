// Isi Firestore dengan contoh kantor 2 lantai lewat service aplikasi (validasi & rules yang sama).
// Jalankan: npm run seed:demo   — hanya berjalan bila belum ada ruangan sama sekali.
import { collection, getDocsFromServer } from 'firebase/firestore';
import { db } from '../src/services/firebase.js';
import { createDoor } from '../src/services/doorService.js';
import { createFloor } from '../src/services/floorService.js';
import { createRoom, setOccupancy } from '../src/services/roomService.js';

// [nama, tipe, x, y, panjang, lebar, kapasitas, occupancy] — satuan meter
const FLOORS = [
  {
    nama: 'Lantai 1',
    rooms: [
      ['Lobby', 'ruangan', 0, 0, 8, 6, 20, 6],
      ['Ruang Tamu VIP', 'ruangan', 0, 6, 8, 4, 6, 2],
      ['Lorong Lantai 1', 'lorong', 8, 4, 14, 2, 15, 3],
      ['Ruang Rapat A', 'ruangan', 8, 0, 6, 4, 10, 8],
      ['Ruang Rapat B', 'ruangan', 14, 0, 5, 4, 8, 0],
      ['Toilet Lantai 1', 'ruangan', 19, 0, 3, 4, 4, 1],
      ['Pantry', 'ruangan', 8, 6, 4, 4, 8, 4],
      ['Ruang Server', 'ruangan', 12, 6, 3, 4, 2, 0],
      ['Tangga Lantai 1', 'tangga', 15, 6, 3, 4, 10, 1],
      ['Lift Lantai 1', 'lift', 18, 6, 2, 3, 8, 0],
    ],
    doors: [
      ['Lobby', 'Lorong Lantai 1'],
      ['Lobby', 'Ruang Tamu VIP'],
      ['Lorong Lantai 1', 'Ruang Rapat A'],
      ['Lorong Lantai 1', 'Ruang Rapat B'],
      ['Lorong Lantai 1', 'Toilet Lantai 1'],
      ['Lorong Lantai 1', 'Pantry'],
      ['Lorong Lantai 1', 'Ruang Server'],
      ['Lorong Lantai 1', 'Tangga Lantai 1'],
      ['Lorong Lantai 1', 'Lift Lantai 1'],
    ],
  },
  {
    nama: 'Lantai 2',
    rooms: [
      ['Ruang Kerja Bersama', 'ruangan', 0, 0, 8, 10, 30, 24],
      ['Lorong Lantai 2', 'lorong', 8, 4, 14, 2, 15, 2],
      ['Ruang Direktur', 'ruangan', 8, 0, 5, 4, 3, 1],
      ['Ruang Manajer', 'ruangan', 13, 0, 4, 4, 4, 2],
      ['Ruang Rapat Besar', 'ruangan', 17, 0, 5, 4, 20, 19],
      ['Ruang Arsip', 'ruangan', 8, 6, 4, 4, 2, 0],
      ['Mushola', 'ruangan', 12, 6, 3, 4, 10, 10],
      ['Tangga Lantai 2', 'tangga', 15, 6, 3, 4, 10, 0],
      ['Lift Lantai 2', 'lift', 18, 6, 2, 3, 8, 0],
      ['Toilet Lantai 2', 'ruangan', 20, 6, 2, 4, 4, 4],
    ],
    doors: [
      ['Ruang Kerja Bersama', 'Lorong Lantai 2'],
      ['Lorong Lantai 2', 'Ruang Direktur'],
      ['Lorong Lantai 2', 'Ruang Manajer'],
      ['Lorong Lantai 2', 'Ruang Rapat Besar'],
      ['Lorong Lantai 2', 'Ruang Arsip'],
      ['Lorong Lantai 2', 'Mushola'],
      ['Lorong Lantai 2', 'Tangga Lantai 2'],
      ['Lorong Lantai 2', 'Lift Lantai 2'],
      ['Lorong Lantai 2', 'Toilet Lantai 2'],
      ['Ruang Direktur', 'Ruang Manajer'],
    ],
  },
];

// Penghubung antar lantai
const VERTICAL_LINKS = [
  ['Tangga Lantai 1', 'Tangga Lantai 2'],
  ['Lift Lantai 1', 'Lift Lantai 2'],
];

const existing = await getDocsFromServer(collection(db, 'rooms'));
if (!existing.empty) {
  console.error(`Dibatalkan: sudah ada ${existing.size} ruangan di database.`);
  process.exit(1);
}

const rooms = [];
const byName = (name) => rooms.find((room) => room.nama_ruangan === name);

for (const floor of FLOORS) {
  const lantai_id = await createFloor(floor.nama);
  console.log(`${floor.nama} (id ${lantai_id})`);

  for (const [nama_ruangan, tipe, x, y, w, h, kapasitas_max, occupancy] of floor.rooms) {
    const rect = { lantai_id, x, y, w, h };
    const id = await createRoom({ nama_ruangan, tipe, kapasitas_max }, rect, rooms);
    const room = { id, nama_ruangan, tipe, kapasitas_max, occupancy: 0, ...rect };
    rooms.push(room);
    if (occupancy > 0) await setOccupancy(room, occupancy);
    console.log(`  + ${nama_ruangan} ${w}×${h} m`);
  }

  for (const [a, b] of floor.doors) {
    await createDoor(byName(a), byName(b));
    console.log(`  pintu ${a} ↔ ${b}`);
  }
}

for (const [a, b] of VERTICAL_LINKS) {
  await createDoor(byName(a), byName(b));
  console.log(`penghubung ${a} ↕ ${b}`);
}

console.log(`Selesai: ${rooms.length} ruangan.`);
process.exit(0);
