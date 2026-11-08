# MedStock Pro

Inventory management for dental clinics, built with an ASP.NET Core API, a React interface, and a Tauri desktop client.

![MedStock Pro](frontend/medstockpro-frontend/src/assets/medstockpro-logo-wide.png)

## Features

- Product, category, and supplier management with barcode scanning and label printing.
- Stock receiving, consumption, movement history, and pending movement approvals.
- Dashboard and reports, low-stock alerts, and expiry monitoring.
- Role-based user management, JWT authentication, and audit logging.
- Database backup workflows and configurable server connections.
- Offline ECDSA-signed licences bound to the server machine.

## Architecture

The backend runs on a main computer and stores data in SQLite. Desktop clients connect to that API on the local network, so they share the same inventory. The backend can run as a Windows Service; the packaged client uses Tauri.

| Layer | Technologies |
| --- | --- |
| API | C#, .NET 10, ASP.NET Core, Entity Framework Core, SQLite |
| Interface | React 19, TypeScript, Vite, Tailwind CSS |
| Client state | TanStack Query, Zustand, React Hook Form, Zod |
| Desktop | Tauri 2, Rust |
| Authentication | JWT, BCrypt password hashing, role-based authorization |

## Repository layout

```text
backend/MedStockPro.Api/       API, models, services, and EF migrations
frontend/medstockpro-frontend/ React application and Tauri wrapper
tools/licensegen/             Licence key generation utility
INSTALLATION.md               Windows deployment and LAN setup
```

Clinic databases, backups, uploads, catalog photos, signing secrets, and private project documents are excluded from this repository.

## Development

Use the .NET 10 SDK and a Node.js version supported by the installed Vite version. Desktop builds also require Rust and the Windows C++ build tools.

### Backend

From `backend/MedStockPro.Api`:

```powershell
dotnet restore
dotnet user-secrets set "Jwt:Key" "<your-random-secret-of-at-least-32-bytes>"
dotnet run --launch-profile http
```

The development API listens at `http://localhost:5218`. EF migrations run at startup. Generate your own secret; never commit it.

### Frontend

In a second terminal, from `frontend/medstockpro-frontend`:

```powershell
npm ci
npm run dev
```

Use the local URL printed by Vite. The client defaults to `http://localhost:5218/api`; its server connection can be changed in the interface.

### Activation and accounts

The API requires an activated machine licence. For a separate development installation, generate your own key pair with `tools/licensegen`, configure its public key, and issue a development licence as described in [INSTALLATION.md](INSTALLATION.md). Keep the private key outside Git.

A fresh database also needs an administrator account provisioned separately. This source snapshot does not include a first-run administrator setup command or shared demo credentials. Existing installations retain their locally stored accounts.

## Build checks

```powershell
# From backend/MedStockPro.Api
dotnet build

# From frontend/medstockpro-frontend
npm run build
npm run lint

# From tools/licensegen
dotnet build
```

The API, frontend production build, and licence utility build successfully. The current frontend lint check reports existing React hook issues and scans generated Tauri output; there is no automated test suite in this snapshot. Backend dependency advisory warnings also remain to be addressed.

For packaged Windows installation, licensing, backups, and multiple client computers, see [the installation guide](INSTALLATION.md).
