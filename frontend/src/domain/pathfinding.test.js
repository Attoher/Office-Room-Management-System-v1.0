import { describe, expect, it } from 'vitest';
import { buildAdjacency, findRoutes, planRoute } from './pathfinding';

const room = (id, occupancy = 0, kapasitas_max = 10) => ({
  id,
  nama_ruangan: `R${id}`,
  occupancy,
  kapasitas_max,
});
const link = (room_from, room_to) => ({ room_from, room_to });

describe('findRoutes', () => {
  it('mengembalikan jalur terpendek lebih dulu', () => {
    // 1-2-3-4 dan jalan pintas 1-4
    const rooms = [room(1), room(2), room(3), room(4)];
    const adjacency = buildAdjacency(rooms, [link(1, 2), link(2, 3), link(3, 4), link(1, 4)]);
    expect(findRoutes(adjacency, 1, 4)).toEqual([
      [1, 4],
      [1, 2, 3, 4],
    ]);
  });

  it('tetap menemukan jalur terpendek walau banyak jalur panjang', () => {
    // Banyak cabang panjang dari 1, jalur langsung 1-99 ditambahkan paling akhir
    const branch = Array.from({ length: 30 }, (_, i) => i + 2);
    const rooms = [room(1), room(99), ...branch.map((id) => room(id))];
    const connections = [
      ...branch.map((id) => link(1, id)),
      ...branch.map((id) => link(id, 99)),
      link(1, 99),
    ];
    const routes = findRoutes(buildAdjacency(rooms, connections), 1, 99, { maxRoutes: 5 });
    expect(routes[0]).toEqual([1, 99]);
    expect(routes).toHaveLength(5);
  });

  it('mengabaikan koneksi ke ruangan yang tidak ada', () => {
    const adjacency = buildAdjacency([room(1), room(2)], [link(1, 2), link(2, 7)]);
    expect(adjacency.get(2)).toEqual([1]);
  });
});

describe('planRoute', () => {
  it('memilih jalur yang tidak melewati ruangan penuh', () => {
    // 1-2-4 lebih pendek tapi 2 penuh; 1-3-5-4 bebas
    const rooms = [room(1), room(2, 10), room(3), room(4), room(5)];
    const plan = planRoute(
      rooms,
      [link(1, 2), link(2, 4), link(1, 3), link(3, 5), link(4, 5)],
      1,
      4,
    );
    expect(plan.status).toBe('aman');
    expect(plan.bestRoute.roomIds).toEqual([1, 3, 5, 4]);
    expect(plan.routes[1].blockedRoomIds).toEqual([2]);
  });

  it('status penuh bila ruangan tujuan penuh', () => {
    const plan = planRoute([room(1), room(2, 5, 5)], [link(1, 2)], 1, 2);
    expect(plan.status).toBe('penuh');
    expect(plan.bestRoute.blockedRoomIds).toEqual([2]);
  });

  it('ruangan asal yang penuh tidak dianggap menghalangi', () => {
    const plan = planRoute([room(1, 5, 5), room(2)], [link(1, 2)], 1, 2);
    expect(plan.status).toBe('aman');
  });

  it('status tidak-ada-jalur bila ruangan tidak terhubung', () => {
    const plan = planRoute([room(1), room(2)], [], 1, 2);
    expect(plan).toEqual({ status: 'tidak-ada-jalur', bestRoute: null, routes: [] });
  });

  it('mengutamakan ruangan yang lebih sepi bila panjang jalurnya sama', () => {
    const rooms = [room(1), room(2, 8), room(3, 1), room(4)];
    const plan = planRoute(rooms, [link(1, 2), link(2, 4), link(1, 3), link(3, 4)], 1, 4);
    expect(plan.bestRoute.roomIds).toEqual([1, 3, 4]);
  });
});
