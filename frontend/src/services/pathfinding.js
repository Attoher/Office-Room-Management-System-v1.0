// Logika pathfinding (dipindahkan dari backend/controllers/pathfindingController.js)

/**
 * Enhanced DFS untuk mencari semua kemungkinan rute dengan depth limit
 */
const findAllPaths = (graph, startId, targetId, maxPaths = 10, maxDepth = 8) => {
  const results = [];

  const dfs = (currentId, path, visited, depth) => {
    if (depth > maxDepth) return;
    if (currentId === targetId) {
      results.push([...path]);
      return;
    }

    for (const neighbor of graph[currentId] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        dfs(neighbor, [...path, neighbor], visited, depth + 1);
        visited.delete(neighbor);

        // Early return jika sudah cukup paths
        if (results.length >= maxPaths) return;
      }
    }
  };

  dfs(startId, [startId], new Set([startId]), 0);
  return results.slice(0, maxPaths);
};

/**
 * Hitung skor efisiensi untuk sebuah rute
 */
const calculateRouteEfficiency = (path, rooms) => {
  const roomData = path.map(id => rooms.find(r => r.id === id)).filter(Boolean);

  if (roomData.length === 0) {
    return {
      efficiency_score: 0,
      avg_occupancy: '0%',
      length: 0
    };
  }

  // Hitung average occupancy rate (lower is better)
  const avgOccupancy = roomData.reduce((sum, room) => {
    return sum + (room.occupancy / room.kapasitas_max);
  }, 0) / roomData.length;

  // Skor berdasarkan panjang rute (shorter is better) dan occupancy (lower is better)
  const lengthScore = Math.max(0, 1 - (path.length - 1) * 0.1);
  const occupancyScore = 1 - avgOccupancy;

  // Weighted score: 40% length, 60% occupancy
  const efficiencyScore = (lengthScore * 0.4 + occupancyScore * 0.6) * 100;

  return {
    efficiency_score: Math.round(efficiencyScore),
    avg_occupancy: (avgOccupancy * 100).toFixed(1) + '%',
    length: path.length - 1
  };
};

export const buildGraph = (rooms, connections) => {
  const graph = {};
  rooms.forEach(room => {
    graph[room.id] = [];
  });

  connections.forEach(conn => {
    if (graph[conn.room_from] && graph[conn.room_to]) {
      graph[conn.room_from].push(conn.room_to);
      graph[conn.room_to].push(conn.room_from); // Bi-directional
    }
  });

  return graph;
};

/**
 * Cari rute dari ruangan start (ID) ke ruangan tujuan (nama, pencocokan sebagian).
 * Melempar Error dengan .status 404 bila ruangan/rute tidak ditemukan.
 */
export const computePath = (rooms, connections, tujuan, start) => {
  const notFound = (message) => Object.assign(new Error(message), { status: 404 });

  const startRoom = rooms.find(room => room.id === start);
  const targetRoom = rooms.find(room =>
    room.nama_ruangan.toLowerCase().includes(tujuan.toLowerCase())
  );

  if (!startRoom) throw notFound(`Start room with ID ${start} not found`);
  if (!targetRoom) throw notFound(`Target room "${tujuan}" not found`);

  const graph = buildGraph(rooms, connections);

  // Cari SEMUA kemungkinan rute (maksimal 10)
  const allPaths = findAllPaths(graph, startRoom.id, targetRoom.id, 10);
  if (allPaths.length === 0) throw notFound('No path found to target room');

  // Hitung efisiensi untuk setiap rute
  const routesWithEfficiency = allPaths.map((path, index) => {
    const efficiency = calculateRouteEfficiency(path, rooms);
    const roomNames = path.map(id => {
      const room = rooms.find(r => r.id === id);
      return room ? room.nama_ruangan : `Unknown (${id})`;
    });

    return {
      rute: roomNames,
      langkah: path.length - 1,
      efisiensi_score: efficiency.efficiency_score,
      avg_occupancy: efficiency.avg_occupancy,
      is_optimal: index === 0
    };
  });

  // Sort routes by efficiency score (descending)
  routesWithEfficiency.sort((a, b) => b.efisiensi_score - a.efisiensi_score);

  // Tentukan rute optimal (yang memiliki skor tertinggi)
  const optimalRoute = routesWithEfficiency[0];

  // Cek jika ada ruangan penuh di rute optimal
  const fullRoomsInOptimalPath = optimalRoute.rute.filter(roomName => {
    const room = rooms.find(r => r.nama_ruangan === roomName);
    return room && room.occupancy >= room.kapasitas_max;
  });

  const hasFullRooms = fullRoomsInOptimalPath.length > 0;

  // Hitung persentase perbandingan dengan optimal untuk setiap rute
  const routesWithComparison = routesWithEfficiency.map(route => ({
    ...route,
    perbandingan_dengan_optimal: Math.round((route.efisiensi_score / optimalRoute.efisiensi_score) * 100) + '%'
  }));

  const response = {
    status: hasFullRooms ? 'penuh' : 'aman',
    jalur_optimal: optimalRoute.rute,
    semua_kemungkinan_rute: routesWithComparison,
    ruangan_asal: startRoom.nama_ruangan,
    ruangan_tujuan: targetRoom.nama_ruangan,
    occupancy_tujuan: `${targetRoom.occupancy}/${targetRoom.kapasitas_max} (${((targetRoom.occupancy / targetRoom.kapasitas_max) * 100).toFixed(1)}%)`
  };

  if (hasFullRooms) {
    response.ruangan_penuh = fullRoomsInOptimalPath;
    response.occupancy = fullRoomsInOptimalPath.map(roomName => {
      const room = rooms.find(r => r.nama_ruangan === roomName);
      return `${room.occupancy}/${room.kapasitas_max}`;
    });
  }

  return response;
};
