import React, { useState, useEffect } from 'react';
import RoomForm from './components/RoomForm';
import RoomList from './components/RoomList';
import ConnectionForm from './components/ConnectionForm';
import ConnectionList from './components/ConnectionList';
import PathfindingForm from './components/PathfindingForm';
import RoomEditModal from './components/RoomEditModal';
import { roomsAPI, connectionsAPI, apiUtils } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [rooms, setRooms] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [editingRoom, setEditingRoom] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Test koneksi Firestore
  const testBackendConnection = async () => {
    try {
      setConnectionStatus('checking');
      
      const connection = await apiUtils.checkConnection();
      
      if (connection.connected) {
        setConnectionStatus('connected');
        return true;
      } else {
        setConnectionStatus('failed');
        return false;
      }
    } catch (error) {
      setConnectionStatus('failed');
      return false;
    }
  };

  // Fetch data dengan better loading handling - FIXED
  const fetchData = async (retryCount = 0) => {
    try {
      setError('');
      setLoading(true);
      
      const isConnected = await testBackendConnection();
      if (!isConnected) {
        throw new Error('Tidak dapat terhubung ke database Firebase');
      }

      const [roomsResponse, connectionsResponse] = await Promise.all([
        roomsAPI.getAll(),
        connectionsAPI.getAll()
      ]);
      
      // FIXED: Langsung menggunakan response karena sudah dinormalisasi di API
      const roomsData = Array.isArray(roomsResponse) ? roomsResponse : [];
      const connectionsData = Array.isArray(connectionsResponse) ? connectionsResponse : [];
      
      setRooms(roomsData);
      setConnections(connectionsData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      
      if (retryCount < 2) {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => fetchData(retryCount + 1), 1000);
        return;
      }
      
      setError('Gagal memuat data. Periksa koneksi internet dan Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close mobile menu when tab changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  // CRUD Handlers
  const handleRoomAdded = () => {
    fetchData();
  };

  const handleRoomEdit = (room) => {
    setEditingRoom(room);
    setIsEditModalOpen(true);
  };

  const handleRoomUpdate = () => {
    setIsEditModalOpen(false);
    setEditingRoom(null);
    fetchData();
  };

  const handleRoomDelete = async (roomId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus ruangan ini? Semua koneksi yang terkait juga akan dihapus.')) {
      try {
        await roomsAPI.delete(roomId);
        fetchData();
      } catch (error) {
        console.error('Error deleting room:', error);
        alert('Gagal menghapus ruangan: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleConnectionAdded = () => {
    fetchData();
  };

  const handleConnectionDeleted = () => {
    fetchData();
  };

  const handleResetAll = async () => {
    if (window.confirm('Reset semua occupancy ke 0?')) {
      try {
        setLoading(true);
        const resetPromises = rooms.map(room => 
          roomsAPI.updateOccupancy(room.id, 0)
        );
        await Promise.all(resetPromises);
        await fetchData();
      } catch (error) {
        console.error('Error resetting rooms:', error);
        alert('Gagal mereset beberapa ruangan');
      } finally {
        setLoading(false);
      }
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'monitoring', name: 'Monitoring', icon: '📊', fullName: 'Monitoring Ruangan' },
    { id: 'management', name: 'Manajemen', icon: '⚙️', fullName: 'Manajemen Data' },
    { id: 'pathfinding', name: 'Jalur Tamu', icon: '🧭', fullName: 'Cek Jalur Tamu' }
  ];

  // Connection status component
  const ConnectionStatus = () => {
    const statusConfig = {
      checking: { color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'Checking...' },
      connected: { color: 'text-green-600', bg: 'bg-green-100', text: 'Connected' },
      failed: { color: 'text-red-600', bg: 'bg-red-100', text: 'Disconnected' }
    };
    
    const config = statusConfig[connectionStatus];
    
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} whitespace-nowrap`}>
        <div className={`w-1.5 h-1.5 rounded-full mr-1 ${
          connectionStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
          connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <span className="hidden sm:inline">{config.text}</span>
      </div>
    );
  };

  // Loading component dengan skeleton screen
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Main Loading Animation */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
              <div className="w-16 h-16 border-4 border-blue-500 rounded-full animate-ping absolute top-0 left-0"></div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">Memuat Dashboard</p>
            <p className="text-gray-600 text-sm mb-4">Menyiapkan sistem manajemen ruangan...</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-3 py-4">
          {/* Top Bar - Mobile & Desktop */}
          <div className="flex justify-between items-center">
            {/* Logo & Title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg bg-blue-500 hover:bg-blue-400 transition-colors"
              >
                <span className="text-lg">{isMobileMenuOpen ? '✕' : '☰'}</span>
              </button>
              <div>
                <h1 className="text-xl font-bold whitespace-nowrap">Office Room Management</h1>
                <p className="text-blue-200 text-xs hidden sm:block">v1.0 - Sistem Manajemen Occupancy</p>
              </div>
            </div>

            {/* Connection Status & Desktop Tabs */}
            <div className="flex items-center space-x-2">
              <ConnectionStatus />
              
              {/* Desktop Tabs */}
              <div className="hidden lg:flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center text-sm ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'bg-blue-500 text-white hover:bg-blue-400'
                    }`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-2 border-t border-blue-500 pt-4">
              <div className="grid grid-cols-1 gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center text-left ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'bg-blue-500 text-white hover:bg-blue-400'
                    }`}
                  >
                    <span className="mr-3 text-lg">{tab.icon}</span>
                    <div>
                      <div className="font-semibold">{tab.name}</div>
                      <div className="text-xs opacity-80">{tab.fullName}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="container mx-auto px-3 mt-3">
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
              <div className="flex-1">
                <strong className="text-sm">Error: </strong>
                <span className="text-sm">{error}</span>
              </div>
              <button 
                onClick={fetchData}
                className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                🔄 Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-3 py-4">
        {/* Mobile Tab Indicator */}
        <div className="lg:hidden mb-4">
          <div className="bg-white rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">
                {tabs.find(tab => tab.id === activeTab)?.fullName}
              </span>
              <span className="text-2xl">
                {tabs.find(tab => tab.id === activeTab)?.icon}
              </span>
            </div>
          </div>
        </div>

        {/* Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {/* Main Monitoring Content */}
              <div className="xl:col-span-3">
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                  <h2 className="text-xl font-bold mb-3">Monitoring Status Ruangan</h2>
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm mb-2">Status warna occupancy:</p>
                    <div className="flex flex-wrap gap-3">
                      <span className="flex items-center text-xs">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        Hijau (&lt;70%)
                      </span>
                      <span className="flex items-center text-xs">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                        Kuning (70-90%)
                      </span>
                      <span className="flex items-center text-xs">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                        Merah (≥90%)
                      </span>
                    </div>
                  </div>
                  
                  {rooms.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-3">🏢</div>
                      <p className="text-gray-500 mb-4">Belum ada ruangan yang ditambahkan</p>
                      <button 
                        onClick={() => setActiveTab('management')}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2.5 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm"
                      >
                        Tambah Ruangan Pertama
                      </button>
                    </div>
                  ) : (
                    <RoomList 
                      rooms={rooms} 
                      onRoomUpdate={fetchData}
                      onRoomEdit={handleRoomEdit}
                      onRoomDelete={handleRoomDelete}
                    />
                  )}
                </div>
              </div>

              {/* Statistics Sidebar */}
              <div className="xl:col-span-1">
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 sticky top-20">
                  <h3 className="text-lg font-bold mb-4 text-gray-800">Statistics</h3>
                  
                  {rooms.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <div className="text-3xl mb-2">📊</div>
                      <p className="text-xs">Data statistics akan muncul setelah ruangan ditambahkan</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Total Rooms */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xl font-bold text-blue-600">{rooms.length}</p>
                            <p className="text-xs text-blue-800 font-medium">Total Ruangan</p>
                          </div>
                          <div className="text-xl text-blue-500">🏢</div>
                        </div>
                      </div>

                      {/* Average Occupancy */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xl font-bold text-green-600">
                              {((rooms.reduce((sum, room) => sum + (room.occupancy / room.kapasitas_max), 0) / rooms.length) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-green-800 font-medium">Avg Occupancy</p>
                          </div>
                          <div className="text-xl text-green-500">👥</div>
                        </div>
                      </div>

                      {/* Total Connections */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xl font-bold text-purple-600">{connections.length}</p>
                            <p className="text-xs text-purple-800 font-medium">Total Koneksi</p>
                          </div>
                          <div className="text-xl text-purple-500">🔗</div>
                        </div>
                      </div>

                      {/* Status Breakdown */}
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-2 text-sm">Status Breakdown</h4>
                        <div className="space-y-1.5">
                          {(() => {
                            const statusCount = {
                              hijau: rooms.filter(r => (r.occupancy / r.kapasitas_max) * 100 < 70).length,
                              kuning: rooms.filter(r => {
                                const percent = (r.occupancy / r.kapasitas_max) * 100;
                                return percent >= 70 && percent < 90;
                              }).length,
                              merah: rooms.filter(r => (r.occupancy / r.kapasitas_max) * 100 >= 90).length
                            };

                            return (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-xs">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                                    Hijau
                                  </span>
                                  <span className="font-semibold text-sm">{statusCount.hijau}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-xs">
                                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
                                    Kuning
                                  </span>
                                  <span className="font-semibold text-sm">{statusCount.kuning}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-xs">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                                    Merah
                                  </span>
                                  <span className="font-semibold text-sm">{statusCount.merah}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                        <h4 className="font-semibold text-orange-800 mb-2 text-sm">Quick Actions</h4>
                        <div className="space-y-1.5">
                          <button 
                            onClick={handleResetAll}
                            className="w-full bg-orange-500 text-white py-1.5 rounded text-xs hover:bg-orange-600 transition-colors"
                          >
                            Reset All to 0
                          </button>
                          <button 
                            onClick={() => setActiveTab('pathfinding')}
                            className="w-full bg-blue-500 text-white py-1.5 rounded text-xs hover:bg-blue-600 transition-colors"
                          >
                            Cek Jalur Tamu
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Management Tab */}
        {activeTab === 'management' && (
          <div className="space-y-6">
            {/* Room Management Section */}
            <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Manajemen Ruangan</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RoomForm onRoomAdded={handleRoomAdded} />
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Daftar Ruangan</h3>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                      {rooms.length} ruangan
                    </span>
                  </div>
                  {rooms.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <div className="text-3xl mb-2">📝</div>
                      <p className="text-sm">Belum ada ruangan yang ditambahkan</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {rooms.map(room => (
                        <RoomItem 
                          key={room.id} 
                          room={room} 
                          onEdit={handleRoomEdit}
                          onDelete={handleRoomDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Connection Management Section */}
            <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Manajemen Koneksi</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConnectionForm 
                  rooms={rooms} 
                  onConnectionAdded={handleConnectionAdded} 
                />
                <ConnectionList 
                  connections={connections} 
                  onConnectionDeleted={handleConnectionDeleted} 
                />
              </div>
            </section>
          </div>
        )}

        {/* Pathfinding Tab */}
        {activeTab === 'pathfinding' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-3">Decision Making, Pathfinding & Visualisasi Graph</h2>
              <p className="text-gray-600 text-sm mb-4">
                Cek ketersediaan jalur untuk tamu dengan visualisasi graph interaktif
              </p>
              
              {rooms.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">🚧</div>
                  <p className="text-gray-500 text-sm mb-4">Belum ada ruangan yang ditambahkan</p>
                  <button 
                    onClick={() => setActiveTab('management')}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2.5 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm"
                  >
                    Tambah Ruangan Pertama
                  </button>
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">🔗</div>
                  <p className="text-gray-500 text-sm mb-4">Belum ada koneksi antar ruangan</p>
                  <button 
                    onClick={() => setActiveTab('management')}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2.5 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm"
                  >
                    Tambah Koneksi
                  </button>
                </div>
              ) : (
                <PathfindingForm rooms={rooms} connections={connections} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Room Modal */}
      {isEditModalOpen && (
        <RoomEditModal
          room={editingRoom}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRoom(null);
          }}
          onUpdate={handleRoomUpdate}
        />
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 mt-8">
        <div className="container mx-auto px-3 text-center">
          <p className="text-gray-400 text-sm">
            Office Room Management System v1.0 &copy; 2025. Developed by ATHA ITS.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Room Item Component untuk management tab - Optimized for mobile
const RoomItem = ({ room, onEdit, onDelete }) => {
  const percentage = (room.occupancy / room.kapasitas_max) * 100;
  let statusColor = 'bg-green-100 text-green-800';
  if (percentage >= 90) statusColor = 'bg-red-100 text-red-800';
  else if (percentage >= 70) statusColor = 'bg-yellow-100 text-yellow-800';

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all group bg-white">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-base group-hover:text-blue-600 transition-colors truncate mr-2">
          {room.nama_ruangan}
        </span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor} flex-shrink-0`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-2">
        <span className="truncate">Luas: {room.luas} m²</span>
        <span className="truncate">Kapasitas: {room.kapasitas_max}</span>
        <span className="truncate">Occupancy: {room.occupancy}</span>
        <span className="truncate">ID: {room.id}</span>
      </div>
      <div className="flex space-x-1.5">
        <button
          onClick={() => onEdit(room)}
          className="flex-1 bg-blue-500 text-white px-2 py-1.5 rounded text-xs hover:bg-blue-600 transition-colors flex items-center justify-center"
        >
          <span className="mr-1">✏️</span>
          Edit
        </button>
        <button
          onClick={() => onDelete(room.id)}
          className="flex-1 bg-red-500 text-white px-2 py-1.5 rounded text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
        >
          <span className="mr-1">🗑️</span>
          Hapus
        </button>
      </div>
    </div>
  );
};

export default App;