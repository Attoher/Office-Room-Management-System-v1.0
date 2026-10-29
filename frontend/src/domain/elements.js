import { END_CLEARANCE, MIN_PIER, geometryOfDoor, rectsOverlap } from './geometry';

// Elemen gambar arsitek selain ruangan & pintu. Satuan meter.
//   jendela  : menempel di sisi ruangan  { room_id, sisi, offset, lebar }
//   kolom    : bebas di lantai           { x, y, w, h }
//   furnitur : di dalam ruangan          { room_id, model, x, y, rotasi } (x, y relatif ruangan)

export const ELEMENT_TYPES = {
  jendela: { label: 'Jendela' },
  kolom: { label: 'Kolom' },
  furnitur: { label: 'Furnitur' },
};

export const WINDOW_DEFAULT_WIDTH = 1.2;
export const WINDOW_MIN_WIDTH = 0.4;
export const COLUMN_DEFAULT_SIZE = 0.4;
export const ELEMENT_SNAP = 0.1;
const EPS = 1e-6;

export const snapElement = (value) => Math.round(value / ELEMENT_SNAP) * ELEMENT_SNAP;
const round2 = (value) => Math.round(value * 100) / 100;

export const ROOM_SIDES = {
  atas: { label: 'Atas' },
  bawah: { label: 'Bawah' },
  kiri: { label: 'Kiri' },
  kanan: { label: 'Kanan' },
};

/** Dinding satu sisi ruangan dalam format yang sama dengan sharedWall. */
export function roomSideWall(room, sisi) {
  switch (sisi) {
    case 'atas':
      return {
        orientation: 'h',
        coord: room.y,
        start: room.x,
        end: room.x + room.w,
        length: room.w,
      };
    case 'bawah':
      return {
        orientation: 'h',
        coord: room.y + room.h,
        start: room.x,
        end: room.x + room.w,
        length: room.w,
      };
    case 'kiri':
      return {
        orientation: 'v',
        coord: room.x,
        start: room.y,
        end: room.y + room.h,
        length: room.h,
      };
    default:
      return {
        orientation: 'v',
        coord: room.x + room.w,
        start: room.y,
        end: room.y + room.h,
        length: room.h,
      };
  }
}

/** Posisi jendela di sisi ruangan; offset = jarak awal sisi ke tengah jendela. */
export function windowGeometry(win, room) {
  const wall = roomSideWall(room, win.sisi);
  const width = Math.min(win.lebar, wall.length - END_CLEARANCE * 2);
  if (width < WINDOW_MIN_WIDTH - EPS) return null;
  const min = width / 2 + END_CLEARANCE;
  const at = wall.start + Math.min(wall.length - min, Math.max(min, win.offset ?? wall.length / 2));
  const half = width / 2;
  return wall.orientation === 'v'
    ? { wall, width, x1: wall.coord, y1: at - half, x2: wall.coord, y2: at + half }
    : { wall, width, x1: at - half, y1: wall.coord, x2: at + half, y2: wall.coord };
}

const onSameLine = (a, b) => a.orientation === b.orientation && Math.abs(a.coord - b.coord) < EPS;
const span = (g) => (g.wall.orientation === 'v' ? [g.y1, g.y2] : [g.x1, g.x2]);
const tooClose = ([a1, a2], [b1, b2]) => a1 < b2 + MIN_PIER - EPS && b1 < a2 + MIN_PIER - EPS;

/** Jendela tidak boleh menimpa pintu atau jendela lain di garis dinding yang sama. */
export function windowPlacementError(win, room, elements, doors, roomsById) {
  const geometry = windowGeometry(win, room);
  if (!geometry) return `Sisi ini terlalu pendek untuk jendela (minimal ${WINDOW_MIN_WIDTH} m).`;
  const mine = span(geometry);

  for (const door of doors) {
    const dg = geometryOfDoor(door, roomsById);
    if (!dg || roomsById.get(door.room_from).lantai_id !== room.lantai_id) continue;
    if (onSameLine(dg.wall, geometry.wall) && tooClose(mine, span(dg))) {
      return 'Jendela terlalu dekat dengan pintu.';
    }
  }
  for (const other of elements) {
    if (other.jenis !== 'jendela' || other.id === win.id) continue;
    const otherRoom = roomsById.get(other.room_id);
    if (!otherRoom || otherRoom.lantai_id !== room.lantai_id) continue;
    const og = windowGeometry(other, otherRoom);
    if (og && onSameLine(og.wall, geometry.wall) && tooClose(mine, span(og))) {
      return 'Jendela terlalu dekat dengan jendela lain.';
    }
  }
  return null;
}

// ---------- Furnitur ----------
// Bentuk digambar di kotak lokal (0..w, 0..h) menghadap ke "atas"; primitif:
//   { t: 'rect', x, y, w, h } | { t: 'circle', cx, cy, r } | { t: 'line', x1, y1, x2, y2 }
const rect = (x, y, w, h) => ({ t: 'rect', x, y, w, h });
const circle = (cx, cy, r) => ({ t: 'circle', cx, cy, r });
const line = (x1, y1, x2, y2) => ({ t: 'line', x1, y1, x2, y2 });
const chairsAlong = (count, from, to, y, r = 0.2) =>
  Array.from({ length: count }, (_, i) => circle(from + ((to - from) * (i + 0.5)) / count, y, r));

export const FURNITURE = {
  meja_kerja: {
    label: 'Meja kerja + kursi',
    w: 1.2,
    h: 1.1,
    seats: 1,
    shapes: [rect(0, 0, 1.2, 0.6), rect(0.4, 0.7, 0.4, 0.4)],
  },
  kursi: {
    label: 'Kursi',
    w: 0.5,
    h: 0.5,
    seats: 1,
    shapes: [rect(0.05, 0.1, 0.4, 0.38), line(0.05, 0.06, 0.45, 0.06)],
  },
  meja_rapat_6: {
    label: 'Meja rapat (6 kursi)',
    w: 2.4,
    h: 2.0,
    seats: 6,
    shapes: [
      rect(0.3, 0.5, 1.8, 1.0),
      ...chairsAlong(3, 0.3, 2.1, 0.25),
      ...chairsAlong(3, 0.3, 2.1, 1.75),
    ],
  },
  meja_rapat_10: {
    label: 'Meja rapat (10 kursi)',
    w: 3.6,
    h: 2.2,
    seats: 10,
    shapes: [
      rect(0.5, 0.5, 2.6, 1.2),
      ...chairsAlong(4, 0.5, 3.1, 0.25),
      ...chairsAlong(4, 0.5, 3.1, 1.95),
      circle(0.25, 1.1, 0.2),
      circle(3.35, 1.1, 0.2),
    ],
  },
  meja_bundar_4: {
    label: 'Meja bundar (4 kursi)',
    w: 1.6,
    h: 1.6,
    seats: 4,
    shapes: [
      circle(0.8, 0.8, 0.45),
      circle(0.8, 0.18, 0.18),
      circle(0.8, 1.42, 0.18),
      circle(0.18, 0.8, 0.18),
      circle(1.42, 0.8, 0.18),
    ],
  },
  sofa: {
    label: 'Sofa (3 orang)',
    w: 2.0,
    h: 0.85,
    seats: 3,
    shapes: [
      rect(0, 0, 2.0, 0.85),
      rect(0.15, 0.25, 1.7, 0.6),
      line(0.72, 0.25, 0.72, 0.85),
      line(1.28, 0.25, 1.28, 0.85),
    ],
  },
  meja_resepsionis: {
    label: 'Meja resepsionis',
    w: 2.4,
    h: 1.4,
    seats: 1,
    shapes: [rect(0, 0, 2.4, 0.7), rect(0, 0, 0.6, 1.4), circle(1.5, 1.1, 0.2)],
  },
  lemari: {
    label: 'Lemari / rak',
    w: 1.0,
    h: 0.5,
    seats: 0,
    shapes: [rect(0, 0, 1.0, 0.5), line(0, 0, 1.0, 0.5), line(1.0, 0, 0, 0.5)],
  },
  toilet: {
    label: 'Kloset',
    w: 0.45,
    h: 0.7,
    seats: 0,
    shapes: [rect(0, 0, 0.45, 0.2), circle(0.225, 0.45, 0.2)],
  },
  wastafel: {
    label: 'Wastafel',
    w: 0.6,
    h: 0.45,
    seats: 0,
    shapes: [rect(0, 0, 0.6, 0.45), circle(0.3, 0.25, 0.13)],
  },
  tanaman: {
    label: 'Tanaman',
    w: 0.5,
    h: 0.5,
    seats: 0,
    shapes: [circle(0.25, 0.25, 0.24), circle(0.25, 0.25, 0.1)],
  },
};

export const ROTATIONS = [0, 90, 180, 270];

/** Ukuran tapak furnitur setelah diputar. */
export function furnitureSize(item) {
  const model = FURNITURE[item.model];
  const turned = item.rotasi === 90 || item.rotasi === 270;
  return turned ? { w: model.h, h: model.w } : { w: model.w, h: model.h };
}

/** Tapak furnitur dalam koordinat denah (absolut). */
export function furnitureRect(item, room) {
  return { x: room.x + item.x, y: room.y + item.y, ...furnitureSize(item) };
}

// Titik lokal (u, v) model → titik di tapak yang sudah diputar searah jarum jam
function rotatePoint(u, v, model, rotasi) {
  switch (rotasi) {
    case 90:
      return { x: model.h - v, y: u };
    case 180:
      return { x: model.w - u, y: model.h - v };
    case 270:
      return { x: v, y: model.w - u };
    default:
      return { x: u, y: v };
  }
}

/** Primitif gambar furnitur dalam koordinat denah (sudah diputar & digeser). */
export function furnitureShapes(item, room) {
  const model = FURNITURE[item.model];
  const origin = { x: room.x + item.x, y: room.y + item.y };
  const at = (u, v) => {
    const p = rotatePoint(u, v, model, item.rotasi ?? 0);
    return { x: origin.x + p.x, y: origin.y + p.y };
  };
  return model.shapes.map((shape) => {
    if (shape.t === 'circle') {
      const c = at(shape.cx, shape.cy);
      return { t: 'circle', cx: c.x, cy: c.y, r: shape.r };
    }
    if (shape.t === 'line') {
      const a = at(shape.x1, shape.y1);
      const b = at(shape.x2, shape.y2);
      return { t: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    const a = at(shape.x, shape.y);
    const b = at(shape.x + shape.w, shape.y + shape.h);
    return {
      t: 'rect',
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  });
}

/** Furnitur harus berada di dalam ruangannya. */
export function furnitureError(item, room) {
  const { w, h } = furnitureSize(item);
  if (item.x < -EPS || item.y < -EPS || item.x + w > room.w + EPS || item.y + h > room.h + EPS) {
    return 'Furnitur keluar dari ruangan.';
  }
  return null;
}

/** Geser posisi furnitur agar tetap di dalam ruangan. */
export function clampFurniture(item, room) {
  const { w, h } = furnitureSize(item);
  return {
    x: round2(Math.min(Math.max(0, item.x), Math.max(0, room.w - w))),
    y: round2(Math.min(Math.max(0, item.y), Math.max(0, room.h - h))),
  };
}

/**
 * Posisi kosong untuk furnitur baru di dalam ruangan, atau null. Diutamakan menempel dinding
 * (seperti penataan sungguhan, dan nama ruangan di tengah denah tetap terbaca), lalu yang paling
 * dekat ke tengah dinding tersebut.
 */
export function findFurnitureSpot(item, room, elements) {
  const { w, h } = furnitureSize(item);
  if (w > room.w + EPS || h > room.h + EPS) return null;
  const others = elements
    .filter((e) => e.jenis === 'furnitur' && e.room_id === room.id && e.id !== item.id)
    .map((e) => furnitureRect(e, room));
  const maxX = round2(room.w - w);
  const maxY = round2(room.h - h);
  const steps = (max) => {
    const values = [];
    for (let v = 0; v <= max + EPS; v += ELEMENT_SNAP * 2) values.push(round2(v));
    if (values.at(-1) !== maxX && max === maxX) values.push(maxX); // ikut posisi menempel kanan
    if (values.at(-1) !== maxY && max === maxY) values.push(maxY); // ikut posisi menempel bawah
    return values;
  };
  const candidates = steps(maxY).flatMap((y) => steps(maxX).map((x) => ({ x, y })));
  const wallDistance = (p) => Math.min(p.x, p.y, maxX - p.x, maxY - p.y);
  const centerDistance = (p) => Math.hypot(p.x - maxX / 2, p.y - maxY / 2);
  candidates.sort(
    (a, b) => wallDistance(a) - wallDistance(b) || centerDistance(a) - centerDistance(b),
  );
  return (
    candidates.find((pos) =>
      others.every((o) => !rectsOverlap({ x: room.x + pos.x, y: room.y + pos.y, w, h }, o)),
    ) ?? null
  );
}

/** Jumlah kursi dari furnitur di sebuah ruangan, sebagai saran kapasitas. */
export function seatsInRoom(roomId, elements) {
  return elements
    .filter((e) => e.jenis === 'furnitur' && e.room_id === roomId)
    .reduce((sum, e) => sum + (FURNITURE[e.model]?.seats ?? 0), 0);
}

// ---------- Dinding luar ----------

/**
 * Bagian sisi ruangan yang berbatasan dengan luar gedung (tidak menempel ruangan dalam lain).
 * Digambar lebih tebal seperti dinding luar di gambar arsitek. Area luar tidak berdinding.
 */
export function exteriorSegments(room, floorRooms) {
  if (room.tipe === 'luar') return [];
  const segments = [];
  for (const sisi of Object.keys(ROOM_SIDES)) {
    const wall = roomSideWall(room, sisi);
    // Rentang sisi ini yang ditutup ruangan dalam lain
    const covered = floorRooms
      .filter((other) => other.id !== room.id && other.tipe !== 'luar')
      .map((other) => {
        const otherWall =
          sisi === 'atas'
            ? roomSideWall(other, 'bawah')
            : sisi === 'bawah'
              ? roomSideWall(other, 'atas')
              : sisi === 'kiri'
                ? roomSideWall(other, 'kanan')
                : roomSideWall(other, 'kiri');
        if (Math.abs(otherWall.coord - wall.coord) > EPS) return null;
        const from = Math.max(wall.start, otherWall.start);
        const to = Math.min(wall.end, otherWall.end);
        return to - from > EPS ? [from, to] : null;
      })
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0]);

    let cursor = wall.start;
    for (const [from, to] of covered) {
      if (from > cursor + EPS) segments.push({ wall, from: cursor, to: from });
      cursor = Math.max(cursor, to);
    }
    if (wall.end > cursor + EPS) segments.push({ wall, from: cursor, to: wall.end });
  }
  return segments.map(({ wall, from, to }) =>
    wall.orientation === 'v'
      ? { x1: wall.coord, y1: from, x2: wall.coord, y2: to }
      : { x1: from, y1: wall.coord, x2: to, y2: wall.coord },
  );
}
