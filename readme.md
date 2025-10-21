# Office Room Management System v1.0

Sistem manajemen ruangan kantor cerdas dengan fitur monitoring occupancy real-time dan algoritma pathfinding untuk optimasi jalur tamu.

![Office Room Management](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)
![Express.js](https://img.shields.io/badge/Express.js-4.18+-000000.svg)

<img width="1919" height="965" alt="image" src="https://github.com/user-attachments/assets/3c756e99-f270-4ea2-96db-7ddf1cf431fc" />

## 🎉 What's New in v1.0 - FIXED & ENHANCED

### 🐛 **Bug Fixes & Improvements**
- ✅ **Fixed Tailwind CSS Configuration** - PostCSS compatibility issues resolved
- ✅ **Enhanced API Integration** - Normalized response handling between frontend and backend
- ✅ **Improved Error Handling** - Better user feedback and error messages
- ✅ **Optimized Pathfinding Algorithm** - Multiple route analysis with efficiency scoring
- ✅ **Fixed Graph Visualization** - Interactive network with proper node highlighting

### 🚀 **Enhanced Features**
- **Smart Pathfinding**: Algorithm now considers both distance and occupancy rates
- **Real-time Monitoring**: Live occupancy updates with color-coded status system
- **Interactive Graph**: Drag-and-drop visualization with optimal path highlighting
- **Mobile Responsive**: Fully optimized for desktop, tablet, and mobile devices

## 🌟 Fitur Utama

### 📊 Real-time Monitoring
- **Sistem Warna Occupancy**: 
  - 🟢 Hijau (<70%) - Aman
  - 🟡 Kuning (70-90%) - Perhatian  
  - 🔴 Merah (≥90%) - Penuh
- **Live Updates**: Perubahan occupancy langsung terlihat di semua tab
- **Dashboard Statistics**: Ringkasan lengkap kondisi ruangan

### 🏢 Manajemen Ruangan Lengkap
- **CRUD Operations**: Tambah, edit, hapus, dan update ruangan
- **Occupancy Control**: Dropdown praktis dan tombol quick-action
- **Bulk Operations**: Reset semua occupancy ke 0 dengan satu klik

### 🔗 Graph & Koneksi
- **Visual Network**: Graph interaktif dengan drag-and-drop nodes
- **Smart Connections**: Koneksi dua arah untuk pathfinding
- **Path Highlighting**: Jalur optimal ditandai dengan warna khusus

### 🧭 Advanced Pathfinding
- **Multiple Route Analysis**: Temukan hingga 10 kemungkinan rute
- **Efficiency Scoring**: Skor berdasarkan panjang rute (40%) + occupancy (60%)
- **Capacity Awareness**: Hindari ruangan penuh secara otomatis
- **Route Comparison**: Bandingkan semua rute dengan yang optimal

## 🏗️ System Architecture

```
Office-Room-Management-System-v1.0/
├── 📂 frontend/                 # React.js + Vite Application
│   ├── 📂 src/
│   │   ├── 📂 components/       # React Components
│   │   │   ├── RoomForm.jsx     # Form tambah ruangan
│   │   │   ├── RoomList.jsx     # List & occupancy control
│   │   │   ├── ConnectionForm.jsx # Form buat koneksi
│   │   │   ├── ConnectionList.jsx # List koneksi
│   │   │   ├── PathfindingForm.jsx # Form pencarian jalur
│   │   │   ├── GraphVisualization.jsx # Visual graph interaktif
│   │   │   ├── RoomEditModal.jsx # Modal edit ruangan
│   │   │   └── StatusIndicator.jsx # Indicator status occupancy
│   │   ├── 📂 services/         # API Services
│   │   │   └── api.js           # Axios configuration & API calls
│   │   ├── 📄 App.jsx           # Main application component
│   │   ├── 📄 main.jsx          # React DOM entry point
│   │   └── 📄 index.css         # Tailwind CSS styles
│   ├── 📄 package.json
│   ├── 📄 tailwind.config.js    # Tailwind configuration
│   └── 📄 postcss.config.js     # PostCSS configuration
├── 📂 backend/                  # Express.js API Server
│   ├── 📂 controllers/          # Business Logic
│   │   ├── roomController.js
│   │   ├── connectionController.js
│   │   └── pathfindingController.js
│   ├── 📂 routes/               # API Routes
│   │   ├── roomRoutes.js
│   │   ├── connectionRoutes.js
│   │   └── pathfindingRoutes.js
│   ├── 📂 utils/                # Utilities
│   │   ├── logger.js
│   │   ├── responseHelper.js
│   │   └── validation.js
│   ├── 📄 server.js             # Main server file
│   ├── 📄 db.js                 # Database configuration
│   └── 📄 package.json
├── 📄 start-dev.js              # Development startup script
└── 📄 README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** (recommended) or 16+
- **PostgreSQL 12+**
- **npm** or **yarn**

### Installation & Setup

1. **Clone Repository**
```bash
git clone https://github.com/Attoher/Office-Room-Management-System-v1.0.git
cd Office-Room-Management-System-v1.0
```

2. **Setup Database**
```sql
-- Create database
CREATE DATABASE office_rooms;

-- Create tables (run in psql or pgAdmin)
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    nama_ruangan VARCHAR(100) NOT NULL UNIQUE,
    luas DECIMAL(10,2) NOT NULL,
    kapasitas_max INTEGER NOT NULL,
    occupancy INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    room_from INTEGER REFERENCES rooms(id),
    room_to INTEGER REFERENCES rooms(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_from, room_to)
);
```

3. **Automatic Setup (Recommended)**
```bash
# Run the development startup script
node start-dev.js
```

4. **Manual Setup (Alternative)**

**Backend Setup:**
```bash
cd backend
npm install

# Configure environment (create .env file)
echo "DATABASE_URL=postgresql://username:password@localhost:5432/office_rooms" > .env
echo "DB_URL=postgresql://username:password@localhost:5432/office_rooms" >> .env
echo "PORT=3000" >> .env
echo "NODE_ENV=development" >> .env

# Start backend
npm run dev
```

**Frontend Setup:**
```bash
cd frontend
npm install

# Start frontend (in new terminal)
npm run dev
```

5. **Access Application**
- 🌐 **Frontend**: http://localhost:5173
- 🔧 **Backend API**: http://localhost:3000
- 📊 **API Health**: http://localhost:3000/api/health

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Core Endpoints

#### 🏢 Rooms Management
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `GET` | `/rooms` | Get all rooms | - |
| `GET` | `/rooms/stats` | Get room statistics | - |
| `GET` | `/rooms/:id` | Get room by ID | - |
| `POST` | `/rooms` | Create new room | `{nama_ruangan, luas, kapasitas_max, occupancy}` |
| `PUT` | `/rooms/:id` | Update room | `{nama_ruangan, luas, kapasitas_max, occupancy}` |
| `DELETE` | `/rooms/:id` | Delete room | - |
| `PUT` | `/rooms/:id/occupancy` | Update occupancy | `{occupancy}` |

#### 🔗 Connections Management
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `GET` | `/connections` | Get all connections | - |
| `GET` | `/connections/debug` | Debug connections | - |
| `POST` | `/connections` | Create connection | `{room_from, room_to}` |
| `DELETE` | `/connections/:id` | Delete connection | - |

#### 🧭 Pathfinding & Analysis
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `POST` | `/pathfinding` | Find optimal path | `{tujuan, start}` |
| `GET` | `/pathfinding/health` | Service health | - |
| `GET` | `/pathfinding/graph` | Graph structure | - |

### Example API Usage

```javascript
// Create a room
const roomData = {
  nama_ruangan: "Meeting Room A",
  luas: 25.5,
  kapasitas_max: 12,
  occupancy: 0
};

// Update occupancy
const occupancyData = {
  occupancy: 8
};

// Create connection
const connectionData = {
  room_from: 1,
  room_to: 2
};

// Find path
const pathfindingData = {
  tujuan: "Meeting Room A",
  start: 1
};
```

## 🎯 Cara Penggunaan

### 1. Monitoring Real-time 📊
1. Buka tab **"Monitoring Ruangan"**
2. Pantau status warna setiap ruangan:
   - 🟢 **Hijau**: Aman (<70% occupancy)
   - 🟡 **Kuning**: Perhatian (70-90% occupancy)  
   - 🔴 **Merah**: Penuh (≥90% occupancy)
3. Ubah occupancy dengan dropdown atau tombol +/-


### 2. Manajemen Data ⚙️
1. **Tambah Ruangan**: Isi form di tab "Manajemen Data"
2. **Buat Koneksi**: Pilih 2 ruangan untuk dihubungkan
3. **Edit/Hapus**: Gunakan tombol di setiap ruangan


### 3. Pathfinding & Visualisasi 🧭
1. Buka tab **"Cek Jalur Tamu"**
2. Pilih ruangan asal (🚀) dan tujuan (🎯)
3. Sistem akan menampilkan:
   - 🏆 **Jalur Optimal** dengan efisiensi tertinggi
   - 📊 **Semua Kemungkinan Rute** dengan skor efisiensi
   - 🗺️ **Visualisasi Graph** dengan jalur yang disorot


### 4. Interaksi Graph 🎨
- **Klik Node**: Pilih ruangan untuk melihat detail
- **Drag & Drop**: Pindahkan node untuk tata letak yang lebih baik
- **Zoom**: Gunakan scroll atau tombol zoom
- **Hover**: Lihat tooltip informasi ruangan

## 🔧 Advanced Features

### Pathfinding Algorithm 🧠
Sistem menggunakan **Enhanced DFS** dengan fitur:

- **Multiple Route Discovery**: Temukan hingga 10 kemungkinan rute
- **Efficiency Scoring**: 
  - 40% bobot untuk panjang rute (shorter = better)
  - 60% bobot untuk average occupancy (lower = better)
- **Capacity Awareness**: Deteksi dan hindari ruangan penuh
- **Depth Limiting**: Maksimal 8 langkah untuk efisiensi

### Graph Visualization 🌐
- **Interactive Network**: Vis.js dengan physics simulation
- **Smart Styling**: Warna node berdasarkan status occupancy
- **Path Highlighting**: Edge berwarna kuning untuk jalur optimal
- **Responsive Design**: Optimized untuk semua ukuran layar

### Real-time Statistics 📈
- **Total Rooms**: Jumlah ruangan aktif
- **Average Occupancy**: Rata-rata penggunaan ruangan
- **Status Breakdown**: Distribusi hijau/kuning/merah
- **Connection Analysis**: Analisis konektivitas graph

## 🛠️ Configuration

### Environment Variables

**Backend (.env)**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/office_rooms
DB_URL=postgresql://username:password@localhost:5432/office_rooms
PORT=3000
NODE_ENV=development
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:3000/api
```

### Database Schema Details

```sql
-- Rooms table
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    nama_ruangan VARCHAR(100) NOT NULL UNIQUE,
    luas DECIMAL(10,2) NOT NULL CHECK (luas > 0),
    kapasitas_max INTEGER NOT NULL CHECK (kapasitas_max > 0),
    occupancy INTEGER DEFAULT 0 CHECK (occupancy >= 0 AND occupancy <= kapasitas_max),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connections table (bidirectional)
CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    room_from INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    room_to INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_from, room_to),
    CHECK (room_from != room_to)
);
```

## 🚀 Deployment

### Production Build

```bash
# Build frontend for production
cd frontend
npm run build

# The build files will be in 'dist' folder
# You can serve them with any static file server

# Start production backend
cd ../backend
npm start
```

### Environment Setup for Production
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
PORT=3000
```

### Docker Support (Optional)

```dockerfile
# Backend Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues & Solutions

1. **Frontend Build Error - Tailwind CSS**
   ```bash
   # Fix Tailwind configuration
   cd frontend
   npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0
   ```

2. **Database Connection Issues**
   ```bash
   # Test PostgreSQL connection
   psql -U postgres -h localhost -p 5432 -d office_rooms
   
   # Check environment variables
   cat backend/.env
   ```

3. **CORS Errors**
   - Pastikan frontend URL ada di allowedOrigins di `backend/server.js`
   - Check environment variables match

4. **Pathfinding Not Working**
   - Pastikan ada koneksi antara ruangan
   - Check console untuk debug information
   - Verifikasi nama ruangan match persis

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
```

## 📝 Changelog

### v1.0.0 - Current Release
- ✅ **Fixed Tailwind CSS Configuration** - Resolved PostCSS compatibility issues
- ✅ **Enhanced API Integration** - Normalized response handling between frontend and backend
- ✅ **Improved Error Handling** - Better user feedback and error messages
- ✅ **Optimized Pathfinding Algorithm** - Multiple route analysis with efficiency scoring
- ✅ **Fixed Graph Visualization** - Interactive network with proper node highlighting
- ✅ **Enhanced Controller Architecture** - Better code organization
- ✅ **Advanced Pathfinding Algorithm** - Multiple route analysis with efficiency scoring
- ✅ **Interactive Graph Visualization** - Drag-and-drop network visualization
- ✅ **Standardized API Responses** - Consistent response format
- ✅ **Comprehensive Error Handling** - Enhanced error management
- ✅ **Real-time Statistics Dashboard** - Advanced monitoring features
- ✅ **Responsive UI/UX** - Mobile-friendly interface
- ✅ **Production Ready** - Optimized for deployment
