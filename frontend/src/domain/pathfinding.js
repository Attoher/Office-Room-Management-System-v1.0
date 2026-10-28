import { doorGeometry, isVerticalType, rectCenter } from './geometry';
import { getOccupancyRatio, isRoomFull } from './occupancy';

/** Biaya pindah lantai lewat tangga/lift, setara meter jalan kaki. */
export const VERTICAL_COST = 6;
/** Tambahan biaya saat memasuki ruangan, sebanding dengan tingkat keterisiannya. */
const CROWD_PENALTY = 3;
export const MAX_ROUTES = 5;

const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * Graph berbobot dari pintu. Pintu satu lantai berbobot jarak tengah ruangan → pintu → tengah
 * ruangan; penghubung tangga/lift antar lantai berbobot VERTICAL_COST. Pintu yang dindingnya
 * sudah tidak ada (ruangan digeser) diabaikan.
 */
export function buildGraph(rooms, doors) {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const edges = new Map(rooms.map((room) => [room.id, []]));

  for (const door of doors) {
    const a = byId.get(door.room_from);
    const b = byId.get(door.room_to);
    if (!a || !b) continue;

    let length;
    if (a.lantai_id !== b.lantai_id) {
      if (!isVerticalType(a.tipe) || !isVerticalType(b.tipe)) continue;
      length = VERTICAL_COST;
    } else {
      const geometry = doorGeometry(a, b, door.offset);
      if (!geometry) continue;
      length = distance(rectCenter(a), geometry.point) + distance(geometry.point, rectCenter(b));
    }
    edges.get(a.id).push({ to: b.id, length });
    edges.get(b.id).push({ to: a.id, length });
  }

  return { byId, edges };
}

const edgeCost = (graph, edge) =>
  edge.length + CROWD_PENALTY * Math.min(1, getOccupancyRatio(graph.byId.get(edge.to)));

/** Dijkstra sederhana (graph kantor kecil). Mengembalikan daftar ID ruangan atau null. */
export function shortestPath(
  graph,
  startId,
  targetId,
  { removedNodes = new Set(), removedEdges = new Set() } = {},
) {
  if (!graph.edges.has(startId) || !graph.edges.has(targetId)) return null;
  const cost = new Map([[startId, 0]]);
  const previous = new Map();
  const done = new Set();

  while (true) {
    let current = null;
    for (const [id, c] of cost) {
      if (!done.has(id) && (current === null || c < cost.get(current))) current = id;
    }
    if (current === null) return null;
    if (current === targetId) break;
    done.add(current);

    for (const edge of graph.edges.get(current)) {
      if (removedNodes.has(edge.to) || removedEdges.has(`${current}>${edge.to}`)) continue;
      const next = cost.get(current) + edgeCost(graph, edge);
      if (!cost.has(edge.to) || next < cost.get(edge.to)) {
        cost.set(edge.to, next);
        previous.set(edge.to, current);
      }
    }
  }

  const path = [targetId];
  while (path[0] !== startId) path.unshift(previous.get(path[0]));
  return path;
}

function measure(graph, roomIds) {
  let length = 0;
  let cost = 0;
  let floorChanges = 0;
  for (let i = 1; i < roomIds.length; i += 1) {
    const edge = graph.edges
      .get(roomIds[i - 1])
      .filter((e) => e.to === roomIds[i])
      .sort((a, b) => a.length - b.length)[0];
    length += edge.length;
    cost += edgeCost(graph, edge);
    if (graph.byId.get(roomIds[i - 1]).lantai_id !== graph.byId.get(roomIds[i]).lantai_id) {
      floorChanges += 1;
    }
  }
  return { length, cost, floorChanges };
}

/** k jalur sederhana dengan biaya terkecil (algoritma Yen). */
export function kShortestPaths(graph, startId, targetId, k = MAX_ROUTES) {
  const first = shortestPath(graph, startId, targetId);
  if (!first) return [];

  const found = [first];
  const candidates = [];
  const key = (path) => path.join('-');

  while (found.length < k) {
    const last = found[found.length - 1];
    for (let i = 0; i < last.length - 1; i += 1) {
      const root = last.slice(0, i + 1);
      const removedEdges = new Set();
      for (const path of found) {
        if (path.length > i + 1 && key(path.slice(0, i + 1)) === key(root)) {
          removedEdges.add(`${path[i]}>${path[i + 1]}`);
        }
      }
      const removedNodes = new Set(root.slice(0, -1));
      const spur = shortestPath(graph, last[i], targetId, { removedNodes, removedEdges });
      if (!spur) continue;
      const candidate = [...root.slice(0, -1), ...spur];
      const candidateKey = key(candidate);
      if (![...found, ...candidates].some((p) => key(p) === candidateKey)) {
        candidates.push(candidate);
      }
    }
    if (candidates.length === 0) break;
    candidates.sort((a, b) => measure(graph, a).cost - measure(graph, b).cost);
    found.push(candidates.shift());
  }

  return found;
}

/**
 * Rencanakan jalur tamu. Ruangan penuh (selain asal) menghalangi; jalur terbaik adalah jalur
 * termurah yang tidak melewati ruangan penuh.
 *
 * status: 'aman' | 'penuh' (tujuan penuh atau semua jalur terhalang) | 'tidak-ada-jalur'
 * route: { roomIds, length (meter), floorChanges, averageOccupancy, blockedRoomIds }
 */
export function planRoute(rooms, doors, startId, targetId) {
  const graph = buildGraph(rooms, doors);
  const fullRooms = new Set(
    rooms.filter((room) => room.id !== startId && isRoomFull(room)).map((room) => room.id),
  );

  const describe = (roomIds) => {
    const { length, cost, floorChanges } = measure(graph, roomIds);
    const ratios = roomIds.map((id) => Math.min(1, getOccupancyRatio(graph.byId.get(id))));
    return {
      roomIds,
      length,
      cost,
      floorChanges,
      averageOccupancy: ratios.reduce((sum, r) => sum + r, 0) / ratios.length,
      blockedRoomIds: roomIds.slice(1).filter((id) => fullRooms.has(id)),
    };
  };

  const routes = kShortestPaths(graph, startId, targetId).map(describe);
  const safePath = fullRooms.has(targetId)
    ? null
    : shortestPath(graph, startId, targetId, { removedNodes: fullRooms });

  if (safePath && !routes.some((r) => r.roomIds.join('-') === safePath.join('-'))) {
    routes.push(describe(safePath));
  }
  routes.sort(
    (a, b) =>
      Number(a.blockedRoomIds.length > 0) - Number(b.blockedRoomIds.length > 0) || a.cost - b.cost,
  );

  const bestRoute = routes[0] ?? null;
  let status = 'aman';
  if (!bestRoute) status = 'tidak-ada-jalur';
  else if (bestRoute.blockedRoomIds.length > 0) status = 'penuh';

  return { status, bestRoute, routes };
}
