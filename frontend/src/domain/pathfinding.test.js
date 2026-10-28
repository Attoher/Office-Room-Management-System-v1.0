import { describe, expect, it } from 'vitest';
import { VERTICAL_COST, buildGraph, kShortestPaths, planRoute } from './pathfinding';

// Denah uji (lantai 1), satuan meter:
//   [A 0..4][B 4..8][C 8..12]   y 0..4
//   [D 0..4][E 4..8][F 8..12]   y 4..8
const room = (id, x, y, extra = {}) => ({
  id,
  lantai_id: 1,
  tipe: 'ruangan',
  x,
  y,
  w: 4,
  h: 4,
  occupancy: 0,
  kapasitas_max: 10,
  ...extra,
});
const door = (room_from, room_to) => ({ id: `${room_from}_${room_to}`, room_from, room_to });

const grid = (overrides = {}) => [
  room(1, 0, 0, overrides[1]),
  room(2, 4, 0, overrides[2]),
  room(3, 8, 0, overrides[3]),
  room(4, 0, 4, overrides[4]),
  room(5, 4, 4, overrides[5]),
  room(6, 8, 4, overrides[6]),
];

describe('buildGraph', () => {
  it('panjang sisi = tengah ruangan → pintu → tengah ruangan', () => {
    const graph = buildGraph(grid(), [door(1, 2)]);
    expect(graph.edges.get(1)).toEqual([{ to: 2, length: 4 }]);
  });

  it('mengabaikan pintu yang dindingnya sudah tidak ada', () => {
    const graph = buildGraph(grid(), [door(1, 3)]);
    expect(graph.edges.get(1)).toEqual([]);
  });

  it('tangga antar lantai berbobot VERTICAL_COST', () => {
    const rooms = [
      room(1, 0, 0, { tipe: 'tangga' }),
      room(2, 0, 0, { tipe: 'tangga', lantai_id: 2 }),
    ];
    expect(buildGraph(rooms, [door(1, 2)]).edges.get(1)).toEqual([
      { to: 2, length: VERTICAL_COST },
    ]);
  });

  it('ruangan biasa tidak bisa dihubungkan lintas lantai', () => {
    const rooms = [room(1, 0, 0), room(2, 0, 0, { lantai_id: 2 })];
    expect(buildGraph(rooms, [door(1, 2)]).edges.get(1)).toEqual([]);
  });
});

describe('kShortestPaths', () => {
  it('mengurutkan jalur dari yang terpendek', () => {
    const doors = [door(1, 2), door(2, 3), door(1, 4), door(4, 5), door(5, 6), door(3, 6)];
    const paths = kShortestPaths(buildGraph(grid(), doors), 1, 3, 3);
    expect(paths[0]).toEqual([1, 2, 3]);
    expect(paths[1]).toEqual([1, 4, 5, 6, 3]);
    expect(paths).toHaveLength(2);
  });
});

describe('planRoute', () => {
  const doors = [door(1, 2), door(2, 3), door(1, 4), door(4, 5), door(5, 6), door(3, 6)];

  it('jalur terpendek bila semua ruangan tersedia', () => {
    const plan = planRoute(grid(), doors, 1, 3);
    expect(plan.status).toBe('aman');
    expect(plan.bestRoute.roomIds).toEqual([1, 2, 3]);
    expect(plan.bestRoute.length).toBe(8);
  });

  it('memutar bila ruangan di tengah penuh', () => {
    const plan = planRoute(grid({ 2: { occupancy: 10 } }), doors, 1, 3);
    expect(plan.status).toBe('aman');
    expect(plan.bestRoute.roomIds).toEqual([1, 4, 5, 6, 3]);
    expect(plan.routes[1].blockedRoomIds).toEqual([2]);
  });

  it('status penuh bila tujuan penuh', () => {
    const plan = planRoute(grid({ 3: { occupancy: 10 } }), doors, 1, 3);
    expect(plan.status).toBe('penuh');
    expect(plan.bestRoute.blockedRoomIds).toEqual([3]);
  });

  it('ruangan asal yang penuh tidak menghalangi', () => {
    const plan = planRoute(grid({ 1: { occupancy: 10 } }), doors, 1, 3);
    expect(plan.status).toBe('aman');
  });

  it('tidak-ada-jalur bila tidak ada pintu yang menyambung', () => {
    const plan = planRoute(grid(), [door(1, 2)], 1, 6);
    expect(plan).toEqual({ status: 'tidak-ada-jalur', bestRoute: null, routes: [] });
  });

  it('menghitung perpindahan lantai', () => {
    const rooms = [
      room(1, 0, 0),
      room(2, 4, 0, { tipe: 'tangga' }),
      room(3, 4, 0, { tipe: 'tangga', lantai_id: 2 }),
      room(4, 8, 0, { lantai_id: 2 }),
    ];
    const plan = planRoute(rooms, [door(1, 2), door(2, 3), door(3, 4)], 1, 4);
    expect(plan.bestRoute.roomIds).toEqual([1, 2, 3, 4]);
    expect(plan.bestRoute.floorChanges).toBe(1);
    expect(plan.bestRoute.length).toBe(4 + VERTICAL_COST + 4);
  });
});
