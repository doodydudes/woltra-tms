# WOLTRA — Trucking Management System

A web-based Trucking Management System for small fleets, with a React frontend and a Node.js/Express backend on Supabase (PostgreSQL + Auth + Storage). Built mobile-first as an installable PWA.

## Tech Stack

- **Frontend**: React 18, Vite, Redux Toolkit, React Router, Recharts, Tailwind CSS
- **Backend**: Node.js, Express.js, PostgreSQL (via the `pg` driver)
- **Database & Storage**: Supabase (PostgreSQL, file storage buckets)
- **Auth**: Supabase Authentication — email/password + Google & GitHub OAuth, role-based access (Owner / Driver)
- **PWA**: Installable, mobile-first UI via the Vite PWA plugin
- **Deployment**: Frontend on Vercel, backend on Render, data on Supabase

## Features

### Multi-tenant Fleets
- Each Owner manages their own isolated fleet — drivers, vehicles, and deliveries are scoped per owner
- Drivers self-register and receive a **driver code**; owners add them by entering that code
- Owners issue **vehicle claim codes** so drivers can claim their assigned truck

### Dashboard
- Delivery statistics (total, in transit, delivered, queued, cancelled)
- Weekly delivery trend chart
- Fleet status overview and recent activity

### Deliveries
- Single-form creation (gate pass, date, outlet, destination, driver, helpers)
- 4-phase workflow with photo proof at each stage:
  1. Loading → In Transit
  2. Arrival → Arrived & Unloading
  3. Unloading proof + customer signature
  4. Documents → Delivered
- CSV export by date range

### Drivers & Vehicles
- Driver profiles, attendance, and per-driver delivery history
- Fleet management with maintenance records

### Salary / Payroll
- Per-location trip rates (province / city / wheel count)
- Driver earnings and owner payroll approval

## Quick Start (local development)

### Prerequisites
- Node.js 18+
- A Supabase project (PostgreSQL connection string + service key, storage buckets: `photos`, `signatures`, `documents`)

### 1. Backend

```bash
cd woltra/backend
cp .env.example .env   # set DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
npm install
npm run dev            # API on http://localhost:5000
```

The schema is applied automatically on startup (idempotent migrations in `server.js`).

### 2. Frontend

```bash
cd woltra/frontend
cp .env.example .env   # set VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # App on http://localhost:5173
```

Or run both together from the repo root: `npm start`.

## API Overview

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/setup-profile`, `GET/PUT /api/auth/profile` |
| Deliveries | `GET/POST /api/deliveries`, `GET/PUT/DELETE /api/deliveries/:id`, `POST /api/deliveries/:id/phase` |
| Drivers | `GET/POST /api/drivers`, `GET/PUT/DELETE /api/drivers/:id`, `GET /api/drivers/lookup` |
| Vehicles | `GET/POST /api/vehicles`, `GET/PUT/DELETE /api/vehicles/:id`, `POST /api/vehicles/:id/maintenance` |
| Salary | `GET/POST/DELETE /api/salary`, `GET /api/salary/payroll`, `POST /api/salary/approve/:id` |
| Reports | `GET /api/reports/export/csv` |
| Dashboard | `GET /api/dashboard/stats` |

## Roles

| Capability | Owner | Driver |
|------------|-------|--------|
| Dashboard | ✓ | ✓ |
| Create / run deliveries | ✓ | ✓ |
| Manage drivers & vehicles | ✓ | ✗ |
| Salary rates & payroll approval | ✓ | view own earnings |

## Project Structure

```
woltra/
├── backend/
│   ├── src/
│   │   ├── config/       # Supabase PostgreSQL connection
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/   # Auth, roles, file upload (Supabase Storage)
│   │   └── routes/       # API routes
│   ├── migrations/       # SQL schema
│   └── server.js         # App + startup migrations
└── frontend/
    └── src/
        ├── components/   # Reusable UI
        ├── features/     # Redux slices
        ├── pages/        # Route pages
        ├── services/     # API client + Supabase client
        └── contexts/     # Theme context
```
