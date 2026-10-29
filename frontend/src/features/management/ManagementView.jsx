import { useState } from 'react';
import { Layers, MousePointerClick } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/feedbackContext';
import { createFloor } from '../../services/floorService';
import DxfTools from './DxfTools';
import ElementInspector from './ElementInspector';
import FloorEditor from './FloorEditor';
import FloorTabs from './FloorTabs';
import RoomInspector from './RoomInspector';
import RoomsSection from './RoomsSection';

export default function ManagementView({
  office,
  floors,
  floorIds,
  rooms,
  roomsById,
  doors,
  elements,
}) {
  const toast = useToast();
  const [floorChoice, setFloorChoice] = useState(null);
  // Yang dipilih di editor: satu ruangan atau satu elemen (jendela/kolom/furnitur)
  const [selection, setSelection] = useState(null); // { kind: 'room' | 'element', id }
  const [creating, setCreating] = useState(false);

  // Lantai terpilih kembali ke lantai pertama bila lantainya dihapus
  const floorId = floors.some((f) => f.id === floorChoice) ? floorChoice : (floors[0]?.id ?? null);
  const selectedRoom = selection?.kind === 'room' ? (roomsById.get(selection.id) ?? null) : null;
  const selectedElement =
    selection?.kind === 'element' ? (elements.find((e) => e.id === selection.id) ?? null) : null;

  const selectRoomId = (id) => setSelection(id == null ? null : { kind: 'room', id });
  const selectElementId = (id) => setSelection(id == null ? null : { kind: 'element', id });
  const selectRoom = (room) => {
    setFloorChoice(room.lantai_id);
    selectRoomId(room.id);
  };

  if (floors.length === 0) {
    const createFirst = async () => {
      setCreating(true);
      try {
        setFloorChoice(await createFloor('Lantai 1', office.id));
      } catch (error) {
        toast.error(error.message);
      } finally {
        setCreating(false);
      }
    };
    return (
      <Card>
        <EmptyState
          icon={Layers}
          title={`${office.nama} belum punya lantai`}
          description="Buat lantai pertama, lalu gambar ruangan-ruangannya di editor denah atau import dari AutoCAD (DXF)."
          action={
            <Button loading={creating} onClick={createFirst}>
              Buat Lantai 1
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* items-start: kartu editor tidak ikut memanjang mengikuti panel detail */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Editor denah"
            description="Gambar ruangan, atur ukuran, pasang pintu, jendela, kolom, dan furnitur."
            action={
              <FloorTabs
                floors={floors}
                rooms={rooms}
                floorId={floorId}
                officeId={office.id}
                onSelect={(id) => {
                  setFloorChoice(id);
                  setSelection(null);
                }}
                editable
              />
            }
          />
          <CardBody>
            <FloorEditor
              key={floorId}
              floorId={floorId}
              floors={floors}
              floorIds={floorIds}
              rooms={rooms}
              roomsById={roomsById}
              doors={doors}
              elements={elements}
              selectedId={selectedRoom?.id ?? null}
              selectedElementId={selectedElement?.id ?? null}
              onSelect={selectRoomId}
              onSelectElement={selectElementId}
              toolbarExtra={
                <DxfTools
                  office={office}
                  floor={floors.find((f) => f.id === floorId)}
                  floors={floors}
                  floorIds={floorIds}
                  rooms={rooms}
                  roomsById={roomsById}
                  doors={doors}
                  elements={elements}
                  onImported={(id) => setFloorChoice(id)}
                />
              }
            />
          </CardBody>
        </Card>

        {/* Panel detail bisa panjang (banyak pintu/tetangga): dibatasi setinggi layar dan di-scroll */}
        <Card className="xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <CardBody>
            {selectedElement ? (
              <ElementInspector
                key={selectedElement.id}
                element={selectedElement}
                roomsById={roomsById}
                elements={elements}
                doors={doors}
                onClose={() => setSelection(null)}
                onSelectRoom={selectRoomId}
              />
            ) : selectedRoom ? (
              <RoomInspector
                key={selectedRoom.id}
                room={selectedRoom}
                rooms={rooms}
                roomsById={roomsById}
                doors={doors}
                elements={elements}
                floors={floors}
                floorIds={floorIds}
                onDeleted={() => setSelection(null)}
                onSelectElement={selectElementId}
              />
            ) : (
              <EmptyState
                icon={MousePointerClick}
                title="Pilih ruangan atau elemen"
                description="Klik ruangan, furnitur, kolom, atau jendela di denah untuk mengatur detailnya."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <RoomsSection
        rooms={rooms}
        floors={floors}
        doors={doors}
        selectedId={selectedRoom?.id ?? null}
        onSelect={selectRoom}
      />
    </div>
  );
}
