import { officeUrl } from '../../hooks/useActiveOffice';
import { getOccupancyStatus, officeStatusRules, summarizeRooms } from '../../domain/occupancy';

/**
 * Isi satu kantor: lantai, ruangan, pintu, elemen, dan ringkasannya menurut aturan status kantor.
 * Lantai lama tanpa office_id dianggap milik kantor pertama (sama dengan useActiveOffice).
 */
export function officeScope(office, offices, { floors, rooms, doors = [], elements = [] }) {
  const officeFloors = floors.filter((f) => (f.office_id ?? offices[0]?.id) === office.id);
  const floorIds = new Set(officeFloors.map((f) => f.id));
  const officeRooms = rooms.filter((r) => floorIds.has(r.lantai_id));
  const roomsById = new Map(officeRooms.map((r) => [r.id, r]));
  const rules = officeStatusRules(office);
  const summary = summarizeRooms(officeRooms, rules);
  return {
    floors: officeFloors,
    rooms: officeRooms,
    roomsById,
    doors: doors.filter((d) => roomsById.has(d.room_from) && roomsById.has(d.room_to)),
    elements: elements.filter((e) => floorIds.has(e.lantai_id)),
    rules,
    statusOf: (room) => getOccupancyStatus(room, rules),
    summary,
    totalArea: officeRooms.reduce((sum, r) => sum + r.luas, 0),
  };
}

/** Halaman publik (Monitoring) kantor ini; dibuka di tab baru dari Back Office. */
export const publicOfficeUrl = (office) => officeUrl('/monitoring', office.id);

export const formatNumber = (value) => value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Nomor lokal 08… → 628… untuk link WhatsApp. */
export const whatsappNumber = (phone) => phone.replace(/^\+/, '').replace(/^0/, '62');
