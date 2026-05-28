# TruckMS - Trucking Management System

A complete production-ready web-based Trucking Management System with React frontend and Node.js/MySQL backend.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Redux Toolkit, React Router, Recharts
- **Backend**: Node.js, Express.js, MySQL2
- **Auth**: JWT, bcryptjs, Role-Based Access Control
- **PWA**: Offline-ready via Vite PWA plugin

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Database Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npm run db:setup
```

### 2. Start Backend

```bash
cd backend
npm run dev
# API running on http://localhost:5000
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

## Default Accounts (Password: `Admin123!`)

| Role       | Email                      |
|------------|----------------------------|
| Admin      | admin@trucking.com         |
| Dispatcher | dispatcher@trucking.com    |
| Driver     | mike@trucking.com          |
| Helper     | tom@trucking.com           |

## Features

### Dashboard
- Real-time delivery statistics
- Weekly delivery trend charts
- Fleet status overview
- Top driver performance
- Recent activity feed

### Delivery Management
- Full CRUD operations
- Gate pass tracking
- BO (Back Order) tracking
- Backlift management
- Proof of delivery (photo + signature upload)
- Delivery timeline/tracking
- Status updates with history
- CSV export

### Driver Management
- Driver profiles with performance stats
- Attendance check-in/check-out
- Delivery history per driver
- License expiry tracking

### Helper Management
- Helper roster management
- Assignment to deliveries

### Vehicle Management
- Fleet status tracking
- Fuel log management
- Maintenance records
- Mileage tracking

### Reports
- Delivery reports (daily/weekly/monthly)
- Driver performance reports
- Back Order (BO) reports
- Return/reject reports
- CSV export

### Notifications
- Real-time notification system
- Delivery assignment alerts
- Maintenance reminders
- Unread count badge

## API Endpoints

### Auth
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `PUT /api/auth/change-password`

### Deliveries
- `GET /api/deliveries` — paginated, searchable, filterable
- `POST /api/deliveries`
- `GET /api/deliveries/:id` — with tracking timeline
- `PUT /api/deliveries/:id`
- `DELETE /api/deliveries/:id`
- `POST /api/deliveries/:id/proof` — upload photo/signature

### Drivers
- `GET /api/drivers`
- `POST /api/drivers`
- `GET /api/drivers/:id` — with stats and attendance
- `PUT /api/drivers/:id`
- `DELETE /api/drivers/:id`
- `POST /api/drivers/:id/checkin`
- `POST /api/drivers/:id/checkout`

### Vehicles
- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/:id`
- `PUT /api/vehicles/:id`
- `DELETE /api/vehicles/:id`
- `POST /api/vehicles/:id/fuel`
- `POST /api/vehicles/:id/maintenance`

### Reports
- `GET /api/reports/deliveries`
- `GET /api/reports/drivers`
- `GET /api/reports/bo`
- `GET /api/reports/returns`
- `GET /api/reports/export/csv`

### Dashboard
- `GET /api/dashboard/stats`

## User Roles & Permissions

| Feature            | Admin | Dispatcher | Driver | Helper |
|--------------------|-------|------------|--------|--------|
| Dashboard          | ✓     | ✓          | ✓      | ✓      |
| View Deliveries    | ✓     | ✓          | ✓      | ✓      |
| Create Deliveries  | ✓     | ✓          | ✗      | ✗      |
| Edit Deliveries    | ✓     | ✓          | ✓*     | ✗      |
| Delete Deliveries  | ✓     | ✗          | ✗      | ✗      |
| Manage Drivers     | ✓     | ✓          | ✗      | ✗      |
| Manage Vehicles    | ✓     | Edit only  | ✗      | ✗      |
| Reports            | ✓     | ✓          | ✗      | ✗      |
| User Management    | ✓     | ✗          | ✗      | ✗      |

*Drivers can update status of their own deliveries

## Project Structure

```
trucking-management/
├── backend/
│   ├── src/
│   │   ├── config/       # Database connection
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/   # Auth, roles, upload
│   │   └── routes/       # API routes
│   ├── database/         # SQL schema + seed
│   ├── uploads/          # Delivery photos/signatures
│   └── server.js
└── frontend/
    └── src/
        ├── components/   # Reusable UI components
        ├── features/     # Redux slices
        ├── pages/        # Route pages
        ├── services/     # API client
        └── contexts/     # Theme context
```
