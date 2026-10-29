import { describe, expect, it } from 'vitest';
import {
  FURNITURE,
  exteriorSegments,
  findFurnitureSpot,
  furnitureError,
  furnitureShapes,
  furnitureSize,
  seatsInRoom,
  windowGeometry,
  windowPlacementError,
} from './elements';
import { DOOR_TYPES, doorPlacementError } from './geometry';

const room = (id, x, y, w, h, extra = {}) => ({
  id,
  nama_ruangan: `R${id}`,
  lantai_id: 1,
  tipe: 'ruangan',
  x,
  y,
  w,
  h,
  ...extra,
});

describe('jendela', () => {
  const a = room(1, 0, 0, 4, 4);
  const b = room(2, 4, 0, 4, 4);
  const byId = new Map([
    [1, a],
    [2, b],
  ]);

  it('posisi jendela di tengah sisi bila tanpa offset', () => {
    expect(windowGeometry({ sisi: 'atas', lebar: 1.2 }, a)).toMatchObject({
      x1: 1.4,
      x2: 2.6,
      y1: 0,
      y2: 0,
    });
  });

  it('jendela tidak boleh menimpa pintu di garis dinding yang sama', () => {
    const doors = [{ id: 'd', room_from: 1, room_to: 2, offset: 2 }];
    const win = { id: 'w', jenis: 'jendela', room_id: 1, sisi: 'kanan', offset: 2, lebar: 1 };
    expect(windowPlacementError(win, a, [win], doors, byId)).toMatch(/pintu/);
    const farWin = { ...win, offset: 3.4, lebar: 0.6 };
    expect(windowPlacementError(farWin, a, [farWin], doors, byId)).toBeNull();
  });
});

describe('jenis pintu', () => {
  it('pintu geser tidak punya daun berayun sehingga tidak bertabrakan di sudut', () => {
    const rooms = [room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4), room(3, 0, 4, 4, 4)];
    const byId = new Map(rooms.map((r) => [r.id, r]));
    const doors = [
      { id: 'ab', room_from: 1, room_to: 2, offset: 99, swing_into: 1 },
      { id: 'ac', room_from: 1, room_to: 3, offset: 99, swing_into: 1, jenis: 'geser' },
    ];
    expect(doorPlacementError(doors[1], doors, byId)).toBeNull();
  });

  it('pintu ganda butuh dinding lebih panjang', () => {
    const rooms = [room(1, 0, 0, 4, 4), room(2, 4, 2.5, 4, 4)]; // dinding bersama 1,5 m
    const byId = new Map(rooms.map((r) => [r.id, r]));
    const door = { id: 'g', room_from: 1, room_to: 2, jenis: 'ganda' };
    expect(DOOR_TYPES.ganda.width).toBeGreaterThan(1.5);
    expect(doorPlacementError(door, [door], byId)).toMatch(/minimal/);
  });
});

describe('furnitur', () => {
  const r = room(1, 10, 10, 4, 3);

  it('ukuran tapak bertukar saat diputar 90°', () => {
    const item = { model: 'meja_rapat_6', rotasi: 90 };
    expect(furnitureSize(item)).toEqual({
      w: FURNITURE.meja_rapat_6.h,
      h: FURNITURE.meja_rapat_6.w,
    });
  });

  it('bentuk diputar tetap berada di dalam tapaknya', () => {
    for (const rotasi of [0, 90, 180, 270]) {
      const item = { model: 'meja_kerja', x: 1, y: 1, rotasi };
      const { w, h } = furnitureSize(item);
      for (const s of furnitureShapes(item, r)) {
        const xs =
          s.t === 'circle'
            ? [s.cx - s.r, s.cx + s.r]
            : s.t === 'line'
              ? [s.x1, s.x2]
              : [s.x, s.x + s.w];
        const ys =
          s.t === 'circle'
            ? [s.cy - s.r, s.cy + s.r]
            : s.t === 'line'
              ? [s.y1, s.y2]
              : [s.y, s.y + s.h];
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(11 - 1e-9);
          expect(x).toBeLessThanOrEqual(11 + w + 1e-9);
        }
        for (const y of ys) {
          expect(y).toBeGreaterThanOrEqual(11 - 1e-9);
          expect(y).toBeLessThanOrEqual(11 + h + 1e-9);
        }
      }
    }
  });

  it('menolak furnitur yang keluar dari ruangan', () => {
    expect(furnitureError({ model: 'sofa', x: 3, y: 0, rotasi: 0 }, r)).toMatch(/keluar/);
    expect(furnitureError({ model: 'sofa', x: 0, y: 0, rotasi: 0 }, r)).toBeNull();
  });

  it('mencari tempat kosong yang tidak menimpa furnitur lain', () => {
    const existing = [
      { id: 'a', jenis: 'furnitur', room_id: 1, model: 'meja_rapat_6', x: 0.8, y: 0.5, rotasi: 0 },
    ];
    const spot = findFurnitureSpot({ model: 'tanaman', rotasi: 0 }, r, existing);
    expect(spot).not.toBeNull();
    const overlapsTable =
      spot.x < 0.8 + 2.4 && 0.8 < spot.x + 0.5 && spot.y < 0.5 + 2.0 && 0.5 < spot.y + 0.5;
    expect(overlapsTable).toBe(false);
  });

  it('furnitur baru menempel dinding, bukan di tengah ruangan', () => {
    const spot = findFurnitureSpot({ model: 'sofa', rotasi: 0 }, r, []);
    const { w, h } = furnitureSize({ model: 'sofa', rotasi: 0 });
    const touchesWall =
      spot.x === 0 ||
      spot.y === 0 ||
      Math.abs(spot.x + w - r.w) < 1e-9 ||
      Math.abs(spot.y + h - r.h) < 1e-9;
    expect(touchesWall).toBe(true);
  });

  it('menghitung kursi sebagai saran kapasitas', () => {
    const elements = [
      { jenis: 'furnitur', room_id: 1, model: 'meja_rapat_6' },
      { jenis: 'furnitur', room_id: 1, model: 'sofa' },
      { jenis: 'furnitur', room_id: 2, model: 'sofa' },
    ];
    expect(seatsInRoom(1, elements)).toBe(9);
  });
});

describe('exteriorSegments', () => {
  it('hanya bagian sisi yang tidak menempel ruangan dalam lain', () => {
    const a = room(1, 0, 0, 4, 4);
    const b = room(2, 4, 0, 4, 2);
    const segments = exteriorSegments(a, [a, b]);
    // sisi kanan a (x = 4) tertutup b di y 0..2, sisanya y 2..4 dinding luar
    expect(segments).toContainEqual({ x1: 4, y1: 2, x2: 4, y2: 4 });
    expect(segments).not.toContainEqual({ x1: 4, y1: 0, x2: 4, y2: 4 });
  });

  it('sisi yang menempel area luar tetap dinding luar', () => {
    const a = room(1, 0, 0, 4, 4);
    const taman = room(2, 0, -3, 4, 3, { tipe: 'luar' });
    expect(exteriorSegments(a, [a, taman])).toContainEqual({ x1: 0, y1: 0, x2: 4, y2: 0 });
    expect(exteriorSegments(taman, [a, taman])).toEqual([]);
  });
});
