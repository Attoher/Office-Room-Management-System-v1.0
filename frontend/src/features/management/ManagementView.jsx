import { useState } from 'react';
import { Layers, MousePointerClick } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/feedbackContext';
import { createFloor } from '../../services/floorService';
import FloorEditor from './FloorEditor';
import FloorTabs from './FloorTabs';
import RoomInspector from './RoomInspector';
import RoomsSection from './RoomsSection';

export default function ManagementView({ floors, rooms, roomsById, doors }) {
  const toast = useToast();
  const [floorChoice, setFloorChoice] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);

  // Lantai terpilih kembali ke lantai pertama bila lantainya dihapus
  const floorId = floors.some((f) => f.id === floorChoice) ? floorChoice : (floors[0]?.id ?? null);
  const selectedRoom = roomsById.get(selectedId) ?? null;

  const selectRoom = (room) => {
    setFloorChoice(room.lantai_id);
    setSelectedId(room.id);
  };

  if (floors.length === 0) {
    const createFirst = async () => {
      setCreating(true);
      try {
        setFloorChoice(await createFloor('Lantai 1'));
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
          title="Belum ada lantai"
          description="Buat lantai pertama, lalu gambar ruangan-ruangannya di editor denah."
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Editor denah"
            description="Gambar ruangan, atur ukuran, lalu pasang pintu di dinding bersama."
            action={
              <FloorTabs
                floors={floors}
                rooms={rooms}
                floorId={floorId}
                onSelect={(id) => {
                  setFloorChoice(id);
                  setSelectedId(null);
                }}
                editable
              />
            }
          />
          <CardBody>
            <FloorEditor
              key={floorId}
              floorId={floorId}
              rooms={rooms}
              roomsById={roomsById}
              doors={doors}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </CardBody>
        </Card>

        <Card className="h-fit xl:sticky xl:top-28">
          <CardBody>
            {selectedRoom ? (
              <RoomInspector
                key={selectedRoom.id}
                room={selectedRoom}
                rooms={rooms}
                roomsById={roomsById}
                doors={doors}
                floors={floors}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <EmptyState
                icon={MousePointerClick}
                title="Pilih ruangan"
                description="Klik ruangan di denah atau di daftar untuk mengatur info, ukuran, tetangga, dan pintunya."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <RoomsSection
        rooms={rooms}
        floors={floors}
        doors={doors}
        selectedId={selectedId}
        onSelect={selectRoom}
      />
    </div>
  );
}
