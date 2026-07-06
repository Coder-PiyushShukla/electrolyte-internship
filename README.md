# PCB Inventory Tracker

A full-stack web application for tracking printed circuit board (PCB) inventory across brands, from inward challan verification through outward dispatch. It provides a live analytics dashboard, delivery-challan PDF generation, multi-provider email delivery, an in-app notification/audit log, and role-based access control.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Authentication and Roles](#authentication-and-roles)
- [Email Delivery](#email-delivery)
- [PDF Generation](#pdf-generation)
- [Notifications](#notifications)
- [Deployment](#deployment)

---

## Overview

The application is organized as a monorepo with two independent packages:

- **`client/`** — a React single-page application (Vite) that serves the dashboard, inward/outward workflows, admin panel, and notification centre.
- **`server/`** — a Node.js/Express REST API backed by PostgreSQL that handles authentication, inventory transactions, dispatch documents, email, and analytics.

Two brands are supported throughout the domain model: **Atomberg** and **Bajaj**. Inventory movement is recorded as `in_ward` (received) and `out_ward` (dispatched) transactions, and outward items carry an `ok` or `scrap` status.

---

## Features

- **Authentication and access control** — JWT-based login, bcrypt password hashing, an admin approval workflow for new registrations, and `admin` / `user` roles.
- **Inward** — challan verification and bulk recording of received quantities into the inventory ledger.
- **Outward** — dispatch creation with automatic DC-number and lot-number generation, live inventory validation, and delivery-challan PDF generation.
- **Analytics dashboard** — live metrics computed from the database: inward vs outward by brand, pending PCBs by part code, monthly OK vs Scrap (with volume/share views), and a part-code inventory table.
- **Excel import** — bulk-load inventory data from spreadsheets.
- **Email** — verification reports and outward challans sent through a three-provider fallback chain (Gmail API, Resend, SMTP).
- **Notifications** — an in-app activity log with per-user read state and admin/all audiences, covering email sends, dispatches, inward records, and user-management events.
- **Audit protection** — transaction history is immutable to standard users; deletion is restricted to admins.

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 6, Recharts, Framer Motion, Axios, React Hot Toast, React Icons |
| Backend | Node.js (>= 18), Express 4, PostgreSQL (`pg`), JSON Web Tokens, bcryptjs |
| Documents | pdfmake (PDF), ExcelJS (spreadsheet import) |
| Email | Gmail REST API, Resend API, Nodemailer (SMTP) |
| Tooling | ESLint, Helmet, Morgan, Multer, dotenv |

---

## Project Structure

```
electrolyte-internship/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Navbar, tables, notification bell, cards, modals
│   │   ├── pages/             # Main (dashboard), Inward, Outward, Admin, Notifications, auth pages
│   │   ├── utils/             # Axios instance and API helpers
│   │   └── App.jsx            # Routes and auth gating
│   └── vite.config.js         # Dev server + /api proxy
│
└── server/                     # Express + PostgreSQL backend
    ├── db/                     # SQL schema and migration scripts
    └── src/
        ├── config/            # DB pool, company and product master data
        ├── controllers/       # Route handlers
        ├── middleware/        # JWT authentication
        ├── routes/            # API route definitions
        ├── services/          # Notification service
        ├── utils/             # Gmail API, financial-year, Excel helpers
        ├── seed.js            # Seeds the default admin user
        └── server.js          # Application entry point
```

---

## Prerequisites

- Node.js **18 or later**
- A **PostgreSQL** database (local instance or a hosted URL)
- npm

---

## Getting Started

Clone the repository and install each package separately.

### 1. Backend

```bash
cd server
npm install
```

Create a `server/.env` file (see [Environment Variables](#environment-variables)), then apply the base schema and seed the default admin user:

```bash
psql "$DATABASE_URL" -f db/init.sql      # base tables (users, pcb_transactions)
npm run seed                             # creates admin / admin123
npm start                                # starts the API on port 5000
```

The outward and notification tables are created automatically at runtime if they do not exist; the corresponding scripts in `server/db/` are also available for manual migration.

### 2. Frontend

```bash
cd client
npm install
npm run dev                              # starts Vite on port 5173
```

The Vite dev server proxies `/api` requests to `http://localhost:5000`, so no additional configuration is required for local development. Open **http://localhost:5173** and sign in with the seeded credentials.

**Default credentials:** `admin` / `admin123`

---

## Environment Variables

Backend configuration is read from `server/.env`.

### Database (use `DATABASE_URL` or the individual `DB_*` variables)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string (SSL enabled automatically). Takes precedence when set. |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` | Individual connection parameters used when `DATABASE_URL` is not set. |

### Application

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `5000` |
| `JWT_SECRET` | Secret used to sign JSON Web Tokens | required |
| `JWT_EXPIRES_IN` | Token lifetime | `24h` |
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:5173`, `http://localhost:3000` |
| `NODE_ENV` | Environment name | — |
| `ADMIN_EMAIL` | Address notified when a new user registers | — |

### Email providers (configure at least one)

| Variable | Description |
|----------|-------------|
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER` | Gmail REST API (OAuth 2.0) credentials |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend HTTP API key and sender |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP transport settings |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API base URL | `/api` (proxied to the backend in development) |

---

## Database

PostgreSQL schema, defined under `server/db/`:

| Table | Purpose |
|-------|---------|
| `users` | Accounts, password hashes, approval state, and roles |
| `pcb_transactions` | Inventory ledger (`in_ward` / `out_ward`, brand, part code, quantity, status) |
| `outward_dispatches` | Dispatch headers with DC/lot numbers and totals |
| `outward_dispatch_items` | Line items for each dispatch |
| `outward_dc_counter`, `outward_lot_counter` | Sequence counters scoped by financial year and brand |
| `notifications` | Activity/audit records |
| `notification_reads` | Per-user read state for notifications |

Schema scripts:

- `db/init.sql` — base tables and default admin placeholder
- `db/add_outward_tables.sql` — outward dispatch tables and counters
- `db/add_notifications_tables.sql` — notification tables
- `db/add_entries_table.sql` — supplementary entries table

Outward and notification tables are also created on demand at runtime, so a fresh deployment functions without running every migration manually.

---

## Available Scripts

### Server (`server/`)

| Script | Action |
|--------|--------|
| `npm start` | Start the API server |
| `npm run dev` | Start the API with file watching (`node --watch`) |
| `npm run seed` | Create the default admin user |

### Client (`client/`)

| Script | Action |
|--------|--------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

---

## API Reference

All endpoints are prefixed with `/api`. Except for the public authentication routes, every request requires an `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/register` | Public | Register a new user (pending approval) |
| `POST` | `/login` | Public | Authenticate and receive a JWT |
| `POST` | `/forgot-password` | Public | Password recovery request |
| `GET` | `/users` | Admin | List all users |
| `PATCH` | `/approve/:id` | Admin | Approve a pending user |
| `DELETE` | `/users/:id` | Admin | Reject or remove a user |

### Transactions — `/api/transactions`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/` | Auth | List transactions (optional `brand`, `type` filters) |
| `GET` | `/summary` | Auth | Totals grouped by part code and brand |
| `GET` | `/analytics/monthly` | Auth | Monthly OK vs Scrap totals |
| `POST` | `/` | Auth | Create a single transaction |
| `DELETE` | `/:id` | Admin | Delete a transaction |

### Inward — `/api/inward`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/record` | Auth | Bulk-record received quantities |

### Outward — `/api/outward`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/company`, `/customers`, `/products` | Auth | Master data |
| `GET` | `/next-dc`, `/lot` | Auth | Peek next DC / lot number |
| `GET` | `/inventory-check` | Auth | Remaining inventory for a part code |
| `POST` | `/dispatches` | Auth | Create a dispatch |
| `GET` | `/dispatches`, `/dispatches/:id` | Auth | List / fetch dispatches |
| `GET` | `/dispatches/:id/download` | Auth | Download the challan PDF |
| `POST` | `/generate-document` | Auth | Generate the challan PDF |
| `POST` | `/send-email` | Auth | Email the challan with PDF attachment |

### Email — `/api/email`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/send-report` | Auth | Email a verification report |

### Notifications — `/api/notifications`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/` | Auth | List visible notifications with unread count |
| `GET` | `/unread-count` | Auth | Unread count for the current user |
| `PATCH` | `/:id/read` | Auth | Mark one notification as read |
| `POST` | `/mark-all-read` | Auth | Mark all visible notifications as read |
| `DELETE` | `/:id` | Admin | Delete a notification record |

### Entries — `/api/entries`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/`, `/part-codes` | Auth | List entries / part codes |
| `POST` | `/` | Auth | Create an entry |
| `DELETE` | `/:id` | Auth | Delete an entry |

### Lot Counter — `/api/lot-counter`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/:brand/peek` | Auth | Peek the next lot number for a brand |
| `POST` | `/:brand/increment` | Auth | Increment the lot counter |

### Upload — `/api/upload`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/` | Auth | Import inventory data from an Excel file (multipart `file`) |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/health/email-config` | Email provider configuration diagnostic |

---

## Authentication and Roles

- Registration creates an account in a **pending** state; login is blocked until an admin approves it.
- Successful login returns a JWT containing the user id, username, and role; the token is stored client-side and attached to every API request.
- The `admin` role unlocks the admin panel (user approval and removal), transaction-history deletion, and notification-record deletion.
- Admin-only actions are enforced on the server, not only hidden in the UI.

---

## Email Delivery

Outbound email uses a three-provider fallback chain, tried in order until one is configured and succeeds:

1. **Gmail REST API** — HTTPS-based, works on restricted hosts, can send to any recipient.
2. **Resend HTTP API** — suitable for platforms that block outbound SMTP.
3. **Nodemailer SMTP** — standard SMTP transport.

The `GET /api/health/email-config` endpoint reports which providers are configured (with masked secrets) and performs a Gmail token check when Gmail credentials are present.

---

## PDF Generation

Outward delivery challans are rendered server-side with **pdfmake**, which requires no browser or system dependencies. PDFs are generated on demand for download and as email attachments.

---

## Notifications

The notification system records significant events as an activity/audit log:

- Email sends (verification report and outward challan) and email failures
- Outward dispatch creation and inward challan recording
- User registration, approval, and removal

Each notification carries an **audience** (`all` or `admin`) that controls visibility, and read state is tracked **per user** so unread counts are independent between accounts. The notification tables are created automatically on first use.

---

## Deployment

The application is suited to platform-as-a-service hosting (for example, Render) with a managed PostgreSQL instance:

- Deploy `server/` as a web service (`npm install`, `npm start`) with the environment variables above. Use the external PostgreSQL connection string for `DATABASE_URL`.
- Deploy `client/` as a static site (`npm run build`, publish `dist/`). Set `VITE_API_URL` to the deployed API origin, and add that origin to the backend `CORS_ORIGIN`.
