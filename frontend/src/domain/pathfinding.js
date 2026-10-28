import { getOccupancyRatio, isRoomFull } from './occupancy';

export const MAX_ROUTES = 10;
export const MAX_HOPS = 8;
// Batas jumlah jalur parsial yang diperiksa supaya graph padat tidak membuat browser hang
const MAX_EXPANSIONS = 20000;

const LENGTH_WEIGHT = 0.4;
const OCCUPANCY_WEIGHT = 0.6;

export function buildAdjacency(rooms, connections) {
  const adjacency = new Map(rooms.map((room) => [room.id, []]));
  for (const { room_from: from, room_to: to } of connections) {
    if (adjacency.has(from) && adjacency.has(to)) {
      adjacency.get(from).push(to);
      adjacency.get(to).push(from); // koneksi berlaku dua arah
    }
  }
  return adjacency;
}

/**
 * Semua jalur sederhana (tanpa ruangan berulang) dari start ke target, diurutkan dari yang
 * paling sedikit langkahnya. BFS atas jalur memastikan jalur terpendek selalu ikut terambil.
 */
export function findRoutes(
  adjacency,
  startId,
  targetId,
  { maxRoutes = MAX_ROUTES, maxHops = MAX_HOPS } = {},
) {
  if (!adjacency.has(startId) || !adjacency.has(targetId)) return [];

  const routes = [];
  const queue = [[startId]];
  let expansions = 0;

  while (queue.length > 0 && routes.length < maxRoutes && expansions < MAX_EXPANSIONS) {
    const path = queue.shift();
    const last = path[path.length - 1];
    expansions += 1;

    if (last === targetId) {
      routes.push(path);
      continue;
    }
    if (path.length - 1 >= maxHops) continue;

    for (const next of adjacency.get(last)) {
      if (!path.includes(next)) queue.push([...path, next]);
    }
  }

  return routes;
}

/** Skor 0–100: makin sedikit langkah dan makin sepi ruangannya, makin tinggi. */
export function scoreRoute(roomIds, roomsById) {
  const hops = roomIds.length - 1;
  const ratios = roomIds.map((id) => Math.min(1, getOccupancyRatio(roomsById.get(id))));
  const averageOccupancy = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;

  const lengthScore = Math.max(0, 1 - hops * 0.1);
  const occupancyScore = 1 - averageOccupancy;
  const score = Math.round((lengthScore * LENGTH_WEIGHT + occupancyScore * OCCUPANCY_WEIGHT) * 100);

  return { hops, averageOccupancy, score };
}

/**
 * Rencanakan jalur tamu dari ruangan asal ke tujuan.
 * Ruangan penuh (selain ruangan asal) dianggap menghalangi; jalur yang bebas hambatan selalu
 * diprioritaskan, baru kemudian skor tertinggi dan langkah paling sedikit.
 *
 * status: 'aman' (ada jalur bebas), 'penuh' (semua jalur terhalang), 'tidak-ada-jalur'
 */
export function planRoute(rooms, connections, startId, targetId) {
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const adjacency = buildAdjacency(rooms, connections);

  const routes = findRoutes(adjacency, startId, targetId)
    .map((roomIds) => ({
      roomIds,
      blockedRoomIds: roomIds.slice(1).filter((id) => isRoomFull(roomsById.get(id))),
      ...scoreRoute(roomIds, roomsById),
    }))
    .sort(
      (a, b) =>
        Number(a.blockedRoomIds.length > 0) - Number(b.blockedRoomIds.length > 0) ||
        b.score - a.score ||
        a.hops - b.hops,
    );

  const bestRoute = routes[0] ?? null;
  let status = 'aman';
  if (!bestRoute) status = 'tidak-ada-jalur';
  else if (bestRoute.blockedRoomIds.length > 0) status = 'penuh';

  return { status, bestRoute, routes };
}
