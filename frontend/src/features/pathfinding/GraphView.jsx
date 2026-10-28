import { useEffect, useRef } from 'react';
import { DataSet, Network } from 'vis-network/standalone';
import { Download, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../../components/ui/Button';
import {
  STATUS_META,
  formatPercent,
  getOccupancyPercent,
  getOccupancyStatus,
} from '../../domain/occupancy';
import { connectionId } from '../../services/connectionService';

const ROLE_COLORS = {
  start: { background: '#2563eb', border: '#1d4ed8' },
  target: { background: '#1e293b', border: '#0f172a' },
};
const ROUTE_EDGE = '#2563eb';
const IDLE_EDGE = '#cbd5e1';

const NETWORK_OPTIONS = {
  autoResize: true,
  layout: { randomSeed: 7 },
  physics: {
    solver: 'barnesHut',
    barnesHut: { gravitationalConstant: -4000, springLength: 160, avoidOverlap: 0.6 },
    stabilization: { iterations: 400 },
  },
  interaction: { hover: true, tooltipDelay: 150, zoomSpeed: 0.6 },
  nodes: {
    shape: 'box',
    margin: { top: 8, right: 12, bottom: 8, left: 12 },
    borderWidth: 2,
    font: { face: 'ui-sans-serif, system-ui, sans-serif', size: 14 },
    shapeProperties: { borderRadius: 8 },
    widthConstraint: { maximum: 160 },
  },
  edges: { smooth: false, selectionWidth: 0 },
};

// Tooltip dibuat sebagai elemen DOM (bukan string HTML) agar nama ruangan tidak bisa menyisipkan markup
function buildTooltip(room, roleLabel) {
  const meta = STATUS_META[getOccupancyStatus(room)];
  const el = document.createElement('div');
  el.style.cssText = 'font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 2px 4px;';
  const lines = [
    room.nama_ruangan,
    `Isi: ${room.occupancy}/${room.kapasitas_max} (${formatPercent(getOccupancyPercent(room))})`,
    `Status: ${meta.label}`,
    `Luas: ${room.luas} m²`,
    roleLabel,
  ].filter(Boolean);
  lines.forEach((text, index) => {
    const line = document.createElement('div');
    line.textContent = text;
    if (index === 0) line.style.fontWeight = '600';
    el.appendChild(line);
  });
  return el;
}

function toNode(room, { startId, targetId, routeIds }) {
  const meta = STATUS_META[getOccupancyStatus(room)];
  const role = room.id === startId ? 'start' : room.id === targetId ? 'target' : null;
  const inRoute = routeIds.has(room.id);
  const color = role
    ? ROLE_COLORS[role]
    : { background: inRoute ? '#eff6ff' : '#ffffff', border: meta.hex };

  return {
    id: room.id,
    label: `${room.nama_ruangan}\n${room.occupancy}/${room.kapasitas_max}`,
    title: buildTooltip(
      room,
      role === 'start' ? 'Ruangan asal' : role === 'target' ? 'Ruangan tujuan' : null,
    ),
    color: { ...color, highlight: color, hover: color },
    borderWidth: inRoute || role ? 3 : 2,
    font: { color: role ? '#ffffff' : '#0f172a', bold: Boolean(role) },
  };
}

export default function GraphView({ rooms, connections, startId, targetId, route, onRoomClick }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);
  const onRoomClickRef = useRef(onRoomClick);
  onRoomClickRef.current = onRoomClick;

  // Network dibuat sekali; perubahan data cukup memperbarui DataSet
  useEffect(() => {
    nodesRef.current = new DataSet();
    edgesRef.current = new DataSet();
    const network = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      NETWORK_OPTIONS,
    );
    let fitted = false;
    // Setelah layout stabil, physics dimatikan supaya ruangan tidak bergeser saat data berubah
    network.on('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } });
      if (!fitted) {
        network.fit({ animation: false });
        fitted = true;
      }
    });
    network.on('click', ({ nodes }) => {
      if (nodes.length > 0) onRoomClickRef.current?.(nodes[0]);
    });
    networkRef.current = network;
    return () => network.destroy();
  }, []);

  useEffect(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const routeIds = new Set(route?.roomIds ?? []);
    const routeEdges = new Set(
      (route?.roomIds ?? []).slice(1).map((id, i) => connectionId(route.roomIds[i], id)),
    );

    const roomIds = new Set(rooms.map((room) => room.id));
    const addedRoom = rooms.some((room) => !nodes.get(room.id));
    nodes.remove(nodes.getIds().filter((id) => !roomIds.has(id)));
    nodes.update(rooms.map((room) => toNode(room, { startId, targetId, routeIds })));

    const edgeIds = new Set(connections.map((c) => c.id));
    edges.remove(edges.getIds().filter((id) => !edgeIds.has(id)));
    edges.update(
      connections.map((c) => {
        const inRoute = routeEdges.has(c.id);
        return {
          id: c.id,
          from: c.room_from,
          to: c.room_to,
          width: inRoute ? 4 : 1.5,
          color: { color: inRoute ? ROUTE_EDGE : IDLE_EDGE, highlight: ROUTE_EDGE },
        };
      }),
    );

    // Ruangan baru perlu ditata ulang; physics dinyalakan sebentar lalu mati lagi setelah stabil
    if (addedRoom) {
      networkRef.current.setOptions({ physics: { enabled: true } });
      networkRef.current.stabilize(200);
    }
  }, [rooms, connections, startId, targetId, route]);

  const zoom = (factor) => {
    const network = networkRef.current;
    network.moveTo({ scale: network.getScale() * factor, animation: { duration: 200 } });
  };

  const exportPng = () => {
    const canvas = containerRef.current.querySelector('canvas');
    const link = document.createElement('a');
    link.download = `graph-ruangan-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-blue-600" aria-hidden /> Asal
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-slate-800" aria-hidden /> Tujuan
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-blue-600" aria-hidden /> Jalur terpilih
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded border-2 border-slate-400 bg-white" aria-hidden />
            Warna tepi = status occupancy
          </li>
        </ul>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            icon={ZoomOut}
            onClick={() => zoom(0.75)}
            aria-label="Perkecil"
          />
          <Button
            variant="ghost"
            size="icon"
            icon={ZoomIn}
            onClick={() => zoom(1.33)}
            aria-label="Perbesar"
          />
          <Button
            variant="ghost"
            size="icon"
            icon={Maximize}
            onClick={() => networkRef.current.fit({ animation: { duration: 300 } })}
            aria-label="Tampilkan semua"
          />
          <Button
            variant="ghost"
            size="icon"
            icon={Download}
            onClick={exportPng}
            aria-label="Unduh PNG"
          />
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[420px] w-full rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200 sm:h-[520px]"
      />
      <p className="mt-2 text-xs text-slate-500">
        Klik ruangan untuk memilih asal lalu tujuan. Seret untuk menggeser, scroll untuk zoom.
      </p>
    </div>
  );
}
