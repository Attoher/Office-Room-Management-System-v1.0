import ConnectionsSection from './ConnectionsSection';
import RoomsSection from './RoomsSection';

export default function ManagementView({ rooms, connections }) {
  return (
    <div className="space-y-8">
      <RoomsSection rooms={rooms} connections={connections} />
      <ConnectionsSection rooms={rooms} connections={connections} />
    </div>
  );
}
