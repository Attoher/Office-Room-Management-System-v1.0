import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  DoorClosed,
  DoorOpen,
  FlipHorizontal2,
  Plus,
  Sofa,
  Trash2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { FURNITURE, ROOM_SIDES, seatsInRoom } from '../../domain/elements';
import {
  DOOR_TYPES,
  MIN_DOOR_WALL,
  ROOM_TYPES,
  doorHingeSide,
  doorType,
  geometryOfDoor,
  doorPlacementError,
  doorSwingInto,
  findNeighbors,
  isVerticalType,
} from '../../domain/geometry';
import { createDoor, deleteDoor, isSamePair, updateDoor } from '../../services/doorService';
import { createFurniture, createWindow, deleteElement } from '../../services/elementService';
import { deleteRoom, updateRoomGeometry, updateRoomInfo } from '../../services/roomService';
import RoomInfoForm from './RoomInfoForm';

const formatMeters = (value) => `${Number(value.toFixed(2))} m`;

function SectionTitle({ children }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h3>
  );
}

/**
 * Detail ruangan terpilih di editor: info, ukuran, tetangga & pintu, penghubung antar lantai,
 * jendela, dan furnitur.
 */
export default function RoomInspector({
  room,
  rooms,
  roomsById,
  doors,
  elements,
  floors,
  onDeleted,
  onSelectElement,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(null);
  const [linkTarget, setLinkTarget] = useState('');
  const [windowSide, setWindowSide] = useState('atas');
  const [furnitureModel, setFurnitureModel] = useState('meja_kerja');
  const myWindows = elements.filter((e) => e.jenis === 'jendela' && e.room_id === room.id);
  const myFurniture = elements.filter((e) => e.jenis === 'furnitur' && e.room_id === room.id);
  const seats = seatsInRoom(room.id, elements);

  const neighbors = useMemo(
    () => findNeighbors(rooms.filter((r) => r.lantai_id === room.lantai_id)).get(room.id) ?? [],
    [rooms, room],
  );
  const myDoors = doors.filter((d) => d.room_from === room.id || d.room_to === room.id);
  const otherOf = (door) =>
    roomsById.get(door.room_from === room.id ? door.room_to : door.room_from);
  const floorName = (id) => floors.find((f) => f.id === id)?.nama ?? '?';

  const verticalLinks = myDoors.filter((d) => otherOf(d).lantai_id !== room.lantai_id);
  // Pintu yang ruangannya tidak lagi bersebelahan (mis. setelah ruangan digeser)
  const brokenDoors = myDoors.filter((d) => {
    const other = otherOf(d);
    return other.lantai_id === room.lantai_id && !geometryOfDoor(d, roomsById);
  });
  const linkCandidates = isVerticalType(room.tipe)
    ? rooms.filter(
        (r) =>
          r.lantai_id !== room.lantai_id &&
          isVerticalType(r.tipe) &&
          !doors.some((d) => isSamePair(d, room.id, r.id)),
      )
    : [];

  const run = async (key, action, success) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Hapus "${room.nama_ruangan}"?`,
      message:
        myDoors.length > 0
          ? `${myDoors.length} pintu/penghubung ruangan ini juga akan dihapus.`
          : 'Ruangan ini akan dihapus permanen.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    await run('delete', () => deleteRoom(room.id), `"${room.nama_ruangan}" dihapus.`);
    onDeleted();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{room.nama_ruangan}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {ROOM_TYPES[room.tipe]?.label} · {floorName(room.lantai_id)} · {room.luas} m²
          </p>
          <div className="mt-2">
            <StatusBadge room={room} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          icon={Trash2}
          loading={busy === 'delete'}
          onClick={handleDelete}
          className="hover:bg-red-50 hover:text-red-600"
          aria-label={`Hapus ${room.nama_ruangan}`}
        />
      </div>

      <section>
        <SectionTitle>Informasi</SectionTitle>
        <RoomInfoForm
          key={`${room.id}-${room.nama_ruangan}-${room.tipe}-${room.kapasitas_max}`}
          initialValues={{
            nama_ruangan: room.nama_ruangan,
            tipe: room.tipe,
            kapasitas_max: String(room.kapasitas_max),
          }}
          currentOccupancy={room.occupancy}
          lockVerticalType={verticalLinks.length > 0}
          submitLabel="Simpan"
          onSubmit={async (values) => {
            await updateRoomInfo(room, values);
            toast.success('Informasi ruangan disimpan.');
          }}
        />
      </section>

      <GeometryForm
        key={`${room.id}-${room.x}-${room.y}-${room.w}-${room.h}`}
        room={room}
        rooms={rooms}
      />

      <section>
        <SectionTitle>Tetangga & pintu</SectionTitle>
        {neighbors.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada ruangan yang menempel. Geser ruangan agar berbagi dinding untuk membuat pintu.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {neighbors.map(({ roomId, wall }) => {
              const other = roomsById.get(roomId);
              const pairDoors = myDoors.filter(
                (d) => isSamePair(d, room.id, roomId) && geometryOfDoor(d, roomsById),
              );
              const canDoor = wall.length >= MIN_DOOR_WALL;
              const addKey = `add-${roomId}`;
              return (
                <li key={roomId} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {pairDoors.length > 0 ? (
                      <DoorOpen className="size-4 shrink-0 text-blue-600" aria-hidden />
                    ) : (
                      <DoorClosed className="size-4 shrink-0 text-slate-300" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{other.nama_ruangan}</p>
                      <p className="text-xs text-slate-500">
                        Dinding {formatMeters(wall.length)} ·{' '}
                        {pairDoors.length > 0 ? `${pairDoors.length} pintu` : 'tanpa pintu'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      loading={busy === addKey}
                      disabled={!canDoor}
                      title={canDoor ? undefined : `Dinding bersama minimal ${MIN_DOOR_WALL} m`}
                      onClick={() => run(addKey, () => createDoor(room, other, doors, roomsById))}
                    >
                      Pintu
                    </Button>
                  </div>
                  {pairDoors.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-7">
                      {pairDoors.map((door, index) => (
                        <DoorRow
                          key={door.id}
                          door={door}
                          label={pairDoors.length > 1 ? `Pintu ${index + 1}` : 'Pintu'}
                          room={room}
                          other={other}
                          doors={doors}
                          roomsById={roomsById}
                          busy={busy}
                          run={run}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {brokenDoors.length > 0 && (
          <ul className="mt-3 space-y-2">
            {brokenDoors.map((door) => (
              <li
                key={door.id}
                className="flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200"
              >
                <span className="min-w-0 flex-1">
                  Pintu ke <strong>{otherOf(door).nama_ruangan}</strong> tidak aktif karena ruangan
                  tidak lagi bersebelahan.
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === door.id}
                  onClick={() => run(door.id, () => deleteDoor(door.id))}
                >
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {room.tipe !== 'luar' && (
        <section>
          <SectionTitle>Jendela</SectionTitle>
          {myWindows.length > 0 && (
            <ul className="mb-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {myWindows.map((win) => (
                <li key={win.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => onSelectElement(win.id)}
                    className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-600"
                  >
                    Sisi {ROOM_SIDES[win.sisi].label.toLowerCase()} · {formatMeters(win.lebar)}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={Trash2}
                    loading={busy === win.id}
                    onClick={() => run(win.id, () => deleteElement(win.id))}
                    className="hover:bg-red-50 hover:text-red-600"
                    aria-label="Hapus jendela"
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Select
              value={windowSide}
              onChange={(e) => setWindowSide(e.target.value)}
              aria-label="Sisi jendela"
            >
              {Object.entries(ROOM_SIDES).map(([key, side]) => (
                <option key={key} value={key}>
                  Sisi {side.label.toLowerCase()}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon={Plus}
              loading={busy === 'window'}
              onClick={() =>
                run('window', async () => {
                  const win = await createWindow(room, windowSide, { elements, doors, roomsById });
                  onSelectElement(win.id);
                })
              }
            >
              Jendela
            </Button>
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Furnitur</SectionTitle>
        {myFurniture.length > 0 && (
          <ul className="mb-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {myFurniture.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => onSelectElement(item.id)}
                  className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-600"
                >
                  {FURNITURE[item.model]?.label ?? item.model}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  loading={busy === item.id}
                  onClick={() => run(item.id, () => deleteElement(item.id))}
                  className="hover:bg-red-50 hover:text-red-600"
                  aria-label="Hapus furnitur"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Select
            value={furnitureModel}
            onChange={(e) => setFurnitureModel(e.target.value)}
            aria-label="Jenis furnitur"
          >
            {Object.entries(FURNITURE).map(([key, model]) => (
              <option key={key} value={key}>
                {model.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            icon={Sofa}
            loading={busy === 'furniture'}
            onClick={() =>
              run('furniture', async () => {
                const item = await createFurniture(room, furnitureModel, elements);
                onSelectElement(item.id);
              })
            }
          >
            Tambah
          </Button>
        </div>
        {seats > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span>
              Furnitur menyediakan <strong>{seats} kursi</strong>
              {seats !== room.kapasitas_max && ` (kapasitas sekarang ${room.kapasitas_max})`}.
            </span>
            {seats !== room.kapasitas_max && (
              <Button
                variant="secondary"
                size="sm"
                loading={busy === 'capacity'}
                disabled={seats < room.occupancy}
                title={
                  seats < room.occupancy
                    ? `Masih ada ${room.occupancy} orang di ruangan`
                    : undefined
                }
                onClick={() =>
                  run(
                    'capacity',
                    () =>
                      updateRoomInfo(room, {
                        nama_ruangan: room.nama_ruangan,
                        tipe: room.tipe,
                        kapasitas_max: seats,
                      }),
                    'Kapasitas diperbarui.',
                  )
                }
              >
                Jadikan kapasitas
              </Button>
            )}
          </div>
        )}
      </section>

      {isVerticalType(room.tipe) && (
        <section>
          <SectionTitle>Penghubung antar lantai</SectionTitle>
          {verticalLinks.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {verticalLinks.map((door) => {
                const other = otherOf(door);
                return (
                  <li key={door.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <ArrowUpDown className="size-4 shrink-0 text-blue-600" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {other.nama_ruangan}{' '}
                      <span className="text-slate-500">· {floorName(other.lantai_id)}</span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy === door.id}
                      onClick={() => run(door.id, () => deleteDoor(door.id))}
                    >
                      Lepas
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {linkCandidates.length > 0 ? (
            <div className="flex gap-2">
              <Select
                value={linkTarget}
                onChange={(e) => setLinkTarget(e.target.value)}
                aria-label="Tangga atau lift di lantai lain"
              >
                <option value="">Pilih tangga/lift di lantai lain</option>
                {linkCandidates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama_ruangan} · {floorName(r.lantai_id)}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!linkTarget}
                loading={busy === 'link'}
                onClick={() =>
                  run('link', async () => {
                    await createDoor(room, roomsById.get(Number(linkTarget)), doors, roomsById);
                    setLinkTarget('');
                  })
                }
              >
                Hubungkan
              </Button>
            </div>
          ) : (
            verticalLinks.length === 0 && (
              <p className="text-sm text-slate-500">
                Tambahkan tangga/lift di lantai lain untuk menghubungkannya.
              </p>
            )
          )}
        </section>
      )}
    </div>
  );
}

/** Satu pintu: arah buka, engsel, peringatan tabrakan, dan tombol aksinya. */
function DoorRow({ door, label, room, other, doors, roomsById, busy, run }) {
  const into = doorSwingInto(door) === room.id ? room : other;
  const geometry = geometryOfDoor(door, roomsById);
  const side = doorHingeSide(geometry, into, door.hinge);
  const swings = doorType(door).swing;
  const conflict = doorPlacementError(door, doors, roomsById);
  const key = (action) => `${action}-${door.id}`;
  return (
    <li className="rounded-md bg-slate-50 px-2 py-1.5">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="min-w-0 flex-1">
          <span className="font-medium text-slate-800">{label}</span>
          {swings ? ` · membuka ke ${into.nama_ruangan} · engsel ${side}` : ''}
        </span>
        <Button
          variant="ghost"
          size="icon"
          icon={Trash2}
          loading={busy === key('delete')}
          onClick={() => run(key('delete'), () => deleteDoor(door.id))}
          className="hover:bg-red-50 hover:text-red-600"
          title="Hapus pintu"
          aria-label={`Hapus ${label.toLowerCase()} ke ${other.nama_ruangan}`}
        />
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <select
          value={door.jenis ?? 'tunggal'}
          disabled={busy === key('type')}
          onChange={(e) =>
            run(key('type'), () => updateDoor(door, { jenis: e.target.value }, doors, roomsById))
          }
          className="h-8 rounded-lg border-0 bg-white py-0 pl-2 pr-7 text-xs text-slate-700 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600"
          aria-label={`Jenis ${label.toLowerCase()}`}
        >
          {Object.entries(DOOR_TYPES).map(([value, type]) => (
            <option key={value} value={value}>
              {type.label} ({type.width} m)
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowLeftRight}
          loading={busy === key('swing')}
          disabled={!swings}
          onClick={() =>
            run(key('swing'), () =>
              updateDoor(
                door,
                { swing_into: into.id === room.id ? other.id : room.id },
                doors,
                roomsById,
              ),
            )
          }
          title={`Daun pintu membuka ke ${into.id === room.id ? other.nama_ruangan : room.nama_ruangan}`}
        >
          Arah buka
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={FlipHorizontal2}
          loading={busy === key('hinge')}
          disabled={!swings || door.jenis === 'ganda'}
          onClick={() =>
            run(key('hinge'), () =>
              updateDoor(door, { hinge: door.hinge === 'end' ? 'start' : 'end' }, doors, roomsById),
            )
          }
          title={`Pindah engsel ke ${side === 'kiri' ? 'kanan' : 'kiri'}`}
        >
          Kiri ⇄ Kanan
        </Button>
      </div>
      {conflict && <p className="mt-1 text-xs text-amber-700">{conflict}</p>}
    </li>
  );
}

function GeometryForm({ room, rooms }) {
  const toast = useToast();
  const [values, setValues] = useState({ x: room.x, y: room.y, w: room.w, h: room.h });
  const [saving, setSaving] = useState(false);
  const changed = ['x', 'y', 'w', 'h'].some((key) => Number(values[key]) !== room[key]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateRoomGeometry(
        room,
        { x: Number(values.x), y: Number(values.y), w: Number(values.w), h: Number(values.h) },
        rooms,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ['x', 'Posisi X'],
    ['y', 'Posisi Y'],
    ['w', 'Panjang'],
    ['h', 'Lebar'],
  ];

  return (
    <section>
      <SectionTitle>Ukuran & posisi (meter)</SectionTitle>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  min={key === 'w' || key === 'h' ? 1 : undefined}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="px-2"
                />
              )}
            </Field>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Luas {Number((Number(values.w) * Number(values.h)).toFixed(2)) || 0} m² · bisa juga
            digeser di denah
          </p>
          <Button type="submit" variant="secondary" size="sm" loading={saving} disabled={!changed}>
            Terapkan
          </Button>
        </div>
      </form>
    </section>
  );
}
