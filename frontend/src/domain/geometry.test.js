import { describe, expect, it } from 'vitest';
import {
  DOOR_WIDTH,
  doorGeometry,
  findNeighbors,
  geometryError,
  offsetFromPoint,
  routeSegmentsByFloor,
  sharedWall,
} from './geometry';

const room = (id, x, y, w, h, extra = {}) => ({
  id,
  nama_ruangan: `R${id}`,
  lantai_id: 1,
  x,
  y,
  w,
  h,
  ...extra,
});

describe('sharedWall', () => {
  it('dinding tegak bersama', () => {
    expect(sharedWall(room(1, 0, 0, 4, 4), room(2, 4, 1, 3, 6))).toEqual({
      orientation: 'v',
      coord: 4,
      start: 1,
      end: 4,
      length: 3,
    });
  });

  it('dinding mendatar bersama', () => {
    expect(sharedWall(room(1, 0, 0, 4, 4), room(2, 2, 4, 6, 2))).toMatchObject({
      orientation: 'h',
      coord: 4,
      start: 2,
      end: 4,
    });
  });

  it('hanya bersentuhan di sudut bukan tetangga', () => {
    expect(sharedWall(room(1, 0, 0, 4, 4), room(2, 4, 4, 2, 2))).toBeNull();
  });

  it('beda lantai bukan tetangga', () => {
    expect(sharedWall(room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4, { lantai_id: 2 }))).toBeNull();
  });
});

describe('findNeighbors', () => {
  it('mendeteksi semua pasangan yang berbagi dinding', () => {
    const rooms = [room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4), room(3, 0, 4, 8, 2)];
    const neighbors = findNeighbors(rooms);
    expect(neighbors.get(1).map((n) => n.roomId)).toEqual([2, 3]);
    expect(neighbors.get(2).map((n) => n.roomId)).toEqual([1, 3]);
  });
});

describe('doorGeometry', () => {
  it('pintu default di tengah dinding bersama', () => {
    const door = doorGeometry(room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4));
    expect(door.point).toEqual({ x: 4, y: 2 });
    expect(door.y2 - door.y1).toBeCloseTo(DOOR_WIDTH);
  });

  it('posisi pintu dibatasi di dalam dinding', () => {
    const door = doorGeometry(room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4), 99);
    expect(door.y2).toBeCloseTo(4);
  });

  it('null bila dinding bersama terlalu pendek', () => {
    expect(doorGeometry(room(1, 0, 0, 4, 4), room(2, 4, 3.5, 4, 4))).toBeNull();
  });

  it('offsetFromPoint mengikuti posisi sepanjang dinding', () => {
    const wall = sharedWall(room(1, 0, 0, 4, 4), room(2, 4, 0, 4, 4));
    expect(offsetFromPoint(wall, { x: 4, y: 1 })).toBe(1);
  });
});

describe('routeSegmentsByFloor', () => {
  it('memecah garis jalur di tangga saat pindah lantai', () => {
    const rooms = [
      room(1, 0, 0, 4, 4),
      room(2, 4, 0, 2, 4, { tipe: 'tangga' }),
      room(3, 4, 0, 2, 4, { tipe: 'tangga', lantai_id: 2 }),
      room(4, 6, 0, 4, 4, { lantai_id: 2 }),
    ];
    const byId = new Map(rooms.map((r) => [r.id, r]));
    const doors = [
      { room_from: 1, room_to: 2 },
      { room_from: 2, room_to: 3 },
      { room_from: 3, room_to: 4 },
    ];
    const segments = routeSegmentsByFloor([1, 2, 3, 4], byId, doors);
    expect(segments.get(1)).toEqual([
      [
        { x: 2, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ],
    ]);
    expect(segments.get(2)).toEqual([
      [
        { x: 5, y: 2 },
        { x: 6, y: 2 },
        { x: 8, y: 2 },
      ],
    ]);
  });
});

describe('geometryError', () => {
  const others = [room(1, 0, 0, 4, 4)];

  it('menolak ruangan yang bertumpuk', () => {
    expect(geometryError(room(2, 2, 2, 4, 4), others)).toMatch(/Bertumpuk dengan R1/);
  });

  it('menempel dinding diperbolehkan', () => {
    expect(geometryError(room(2, 4, 0, 4, 4), others)).toBeNull();
  });

  it('lantai lain boleh di posisi sama', () => {
    expect(geometryError(room(2, 0, 0, 4, 4, { lantai_id: 2 }), others)).toBeNull();
  });

  it('menolak sisi terlalu kecil', () => {
    expect(geometryError(room(2, 10, 10, 0.5, 4), others)).toMatch(/minimal/);
  });
});
