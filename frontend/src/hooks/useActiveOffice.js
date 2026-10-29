import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'orm:kantor';

function readStoredOffice() {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('kantor'));
  if (Number.isInteger(fromUrl) && fromUrl > 0) return fromUrl;
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Tulis ?kantor=ID di URL tanpa membuang parameter lain. */
function withOfficeParam(path, officeId) {
  const params = new URLSearchParams(window.location.search);
  if (officeId > 0) params.set('kantor', officeId);
  else params.delete('kantor');
  const query = params.toString();
  return `${path}${query ? `?${query}` : ''}`;
}

/** URL halaman lain yang hanya membawa pilihan kantor. */
export const officeUrl = (path, officeId) => (officeId > 0 ? `${path}?kantor=${officeId}` : path);

/**
 * Kantor yang sedang dibuka. Urutan: ?kantor=ID di URL, pilihan terakhir di browser, kantor
 * pertama. Juga memecah data menjadi milik kantor tersebut saja.
 *
 * Lantai lama tanpa office_id dianggap milik kantor pertama, supaya data tetap tampil sebelum
 * dimigrasikan.
 */
export function useActiveOffice({ offices, floors, rooms, doors, elements }) {
  const [choice, setChoice] = useState(readStoredOffice);

  const officeId = offices.some((o) => o.id === choice) ? choice : (offices[0]?.id ?? null);
  const office = offices.find((o) => o.id === officeId) ?? null;

  // Simpan pilihan di URL & browser supaya link bisa dibagikan dan diingat
  useEffect(() => {
    if (!(officeId > 0)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(officeId));
    } catch {
      // abaikan: hanya kenyamanan
    }
    const next = withOfficeParam(window.location.pathname, officeId);
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [officeId]);

  const selectOffice = useCallback((id) => {
    // Pilihan asal/tujuan jalur milik kantor sebelumnya tidak berlaku lagi
    const params = new URLSearchParams(window.location.search);
    params.delete('asal');
    params.delete('tujuan');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${params.toString() ? `?${params}` : ''}`,
    );
    setChoice(id);
  }, []);

  const floorOffice = useCallback((floor) => floor.office_id ?? offices[0]?.id ?? null, [offices]);

  const scoped = useMemo(() => {
    const officeFloors = floors.filter((f) => floorOffice(f) === officeId);
    const floorIds = new Set(officeFloors.map((f) => f.id));
    const officeRooms = rooms.filter((r) => floorIds.has(r.lantai_id));
    const roomIds = new Set(officeRooms.map((r) => r.id));
    return {
      floors: officeFloors,
      floorIds,
      rooms: officeRooms,
      roomsById: new Map(officeRooms.map((r) => [r.id, r])),
      doors: doors.filter((d) => roomIds.has(d.room_from) && roomIds.has(d.room_to)),
      elements: elements.filter((e) => floorIds.has(e.lantai_id)),
    };
  }, [floors, rooms, doors, elements, officeId, floorOffice]);

  // Ringkasan setiap kantor untuk pemilih kantor
  const summaries = useMemo(
    () =>
      new Map(
        offices.map((o) => {
          const ids = new Set(floors.filter((f) => floorOffice(f) === o.id).map((f) => f.id));
          const officeRooms = rooms.filter((r) => ids.has(r.lantai_id));
          return [
            o.id,
            {
              floors: ids.size,
              rooms: officeRooms.length,
              occupancy: officeRooms.reduce((sum, r) => sum + r.occupancy, 0),
              capacity: officeRooms.reduce((sum, r) => sum + r.kapasitas_max, 0),
            },
          ];
        }),
      ),
    [offices, floors, rooms, floorOffice],
  );

  return { office, officeId, selectOffice, summaries, ...scoped };
}
