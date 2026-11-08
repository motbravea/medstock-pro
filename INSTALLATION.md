# MedStock Pro — Deployment & Installation Guide

This guide is for the **developer** building MedStock Pro and installing it in a
clinic. The clinic receives only the **built app + backend**, never this source
repository.

### Architecture — one server, many clients

- **Main clinic computer (server)**: runs the backend as a Windows Service,
  holds the SQLite **database**, uploads, backups, logs, and the machine-locked
  **licence**. It listens on the clinic LAN (`http://<main-ip>:5218`).
- **Client computers (administrators and staff)**: install **only** the desktop app.
  No backend, no database. Each client connects to the main computer's address,
  so **all computers share the same live data**.
- **Data lives only on the main computer** under `C:\ProgramData\MedStockPro\`.
  There is no per-client database and no sync between copies.
- **Licensing**: offline, machine-locked to the main computer, ECDSA-signed.

> If you only have ONE computer, it is both server and client: install the
> backend + app on it and leave the server address as `http://localhost:5218`.

---

## 0. What ships vs. what stays with you

| Ships to the clinic PC | Stays with the developer (never ship / never commit) |
|---|---|
| Built backend (`publish` output) | Development tools; source is available separately for review |
| Built Tauri app (`.exe` / installer) | The **private** signing key; `tools/licensegen` is source only |
| `appsettings.json` (contains only the **public** key) | User-secrets and any private development overrides |
| `appsettings.Production.json` | The clinic database / uploads / backups / logs |

`.gitignore` already excludes: `.env`, `secrets.json`, private keys, the local
`database/`, all `Uploads/`, `Backups/`, `Logs/`, `bin/`, `obj/`,
`node_modules/`, `dist/`, and `src-tauri/target/`.

---

## 1. Prerequisites (developer machine)

- **.NET 10 SDK** — `dotnet --version`
- **Node.js compatible with the installed Vite version** and npm — `node --version`
- **Rust toolchain** (for Tauri) — https://www.rust-lang.org/tools/install
- **Visual Studio Build Tools** with the "Desktop development with C++" workload
  (Tauri needs the MSVC linker).

---

## 2. One-time: create the licence signing keys

The app verifies licences with a **public** key it ships; you issue licences
with the matching **private** key, which never leaves your machine.

```powershell
cd tools\licensegen
dotnet run -- keygen
```

This prints a **PUBLIC KEY** and a **PRIVATE KEY**.

1. Paste the **PUBLIC KEY** into `backend/MedStockPro.Api/appsettings.json` →
   `License:PublicKey`. (Safe to commit / ship.)
2. Store the **PRIVATE KEY** somewhere secure (password manager). **Never**
   commit it, never put it on a clinic PC.

> Only a public verification key is included in `appsettings.json`. Its private
> counterpart is not in this repository. For a separate installation, run
> `keygen`, configure your new public key, and issue licences with its matching
> private key. Existing licences must be re-issued if the public key changes.

---

## 3. Issue a licence key for a clinic

```powershell
cd tools\licensegen
dotnet run -- issue --clinic "Example Dental Clinic" --devices 1 --expires 2028-12-31 --private "<YOUR PRIVATE KEY>"
```

- `--clinic` must match **exactly** what the clinic types during activation.
- `--expires` is optional; omit for a perpetual licence.

Copy the printed **LICENCE KEY** and give it to the clinic (email/paper).

---

## 4. Build the backend

From `backend/MedStockPro.Api`:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -o C:\MedStockPublish\backend
```

- `--self-contained true` means the clinic PC does **not** need the .NET runtime
  installed. (Use `false` + install the ASP.NET Core Runtime if you prefer a
  smaller package.)
- Output folder contains `MedStockPro.Api.exe`, `appsettings.json`,
  `appsettings.Production.json`, and the migrations. That whole folder is what
  you install on the clinic PC.

Provide the **JWT signing key** in production via an environment variable (see
§7). It is not stored in any shipped file.

---

## 5. Build the Tauri desktop app

From `frontend/medstockpro-frontend`:

```powershell
npm install
npm run tauri build
```

The installer/executable is produced under
`frontend/medstockpro-frontend/src-tauri/target/release/bundle/`
(`nsis\*-setup.exe` or `msi\*.msi`).

The app connects to the backend at `http://localhost:5218` automatically — no
configuration needed on the clinic side.

---

## 6. Install on the clinic computer

1. **Copy the backend** publish folder (from §4) to, e.g.,
   `C:\Program Files\MedStockPro\backend\`.
2. **Run the Tauri installer** (from §5) to install the desktop app.
3. **Set the JWT key** (§7).
4. **Install the backend as a Windows Service** (§8) so it starts on boot.
5. **Launch the app** and **activate the licence** (§9).

`C:\ProgramData\MedStockPro\` (Database / Uploads / Backups / Logs) is created
automatically on first run.

---

## 7. Security: the JWT key in production

The backend refuses to start without a JWT signing key. In production, provide
it as a **machine-level environment variable** (not a file):

```powershell
# Run as Administrator. 48 random bytes, base64. One time per clinic PC.
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
[Environment]::SetEnvironmentVariable("JWT__KEY", $key, "Machine")
```

`JWT__KEY` (double underscore) maps to `Jwt:Key`. The value is never written to
the repo or the publish output.

Swagger is automatically **disabled** outside Development. CORS in production is
restricted (see `appsettings.Production.json`) to the packaged Tauri app
origins. Network access is further restricted to the private clinic LAN by the
Windows Firewall rule in §8.

---

## 8. Run the backend as a Windows Service

The backend detects the Service Control Manager automatically
(`UseWindowsService`). Create and start the service (run as Administrator):

```powershell
sc.exe create MedStockProApi binPath= "C:\Program Files\MedStockPro\backend\MedStockPro.Api.exe" start= auto
sc.exe description MedStockProApi "MedStock Pro local backend service"
# Make sure the service also sees the environment/JWT key and Production env:
setx /M ASPNETCORE_ENVIRONMENT Production
sc.exe start MedStockProApi
```

- `ASPNETCORE_ENVIRONMENT=Production` makes it use `%PROGRAMDATA%\MedStockPro`
  and bind to `http://0.0.0.0:5218` (all interfaces) so client PCs on the clinic
  LAN can reach it.
- To stop / remove: `sc.exe stop MedStockProApi` / `sc.exe delete MedStockProApi`.
- The service runs as **LocalSystem** by default; that account can read
  `JWT__KEY` set at Machine scope and write to `C:\ProgramData`.

> Prefer not to use a service? You can instead auto-start the backend `.exe`
> with a Startup shortcut the same way as the desktop app (§10).

### 8.1 Open the firewall port for the clinic network only

So client computers can reach the backend — but only on the **private** clinic
network, never public Wi-Fi (run as Administrator):

```powershell
New-NetFirewallRule -DisplayName "MedStock Pro API" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5218 -Profile Private
```

This is only needed on the **main computer**. Client computers need no firewall
change. To remove later:
`Remove-NetFirewallRule -DisplayName "MedStock Pro API"`.

---

## 9. Activate the licence (first launch)

1. Start the backend service (§8) and open the MedStock Pro desktop app.
2. Because no licence is active yet, the app shows **Activate MedStock Pro**.
3. Enter the **clinic name** (exactly as issued) and paste the **licence key**.
4. Click **Activate this computer**.

The licence is now bound to this machine. If the database/app is copied to a
different computer, the machine fingerprint won't match and the app shows:

> *This installation is not licensed for this computer. Please contact the developer.*

**To move a licence to a new PC**: issue a fresh key (§3) and, on the new PC,
delete the `Licenses` row (or the ProgramData database if starting fresh), then
activate again.

---

## 10. Auto-launch options

**A) Open automatically after install** — the Tauri NSIS installer offers a
"Run MedStock Pro" checkbox at the end. Leave it ticked.

**B) Launch when Windows starts** — create a Startup shortcut (no admin needed,
per-user):

```powershell
$startup = [Environment]::GetFolderPath("Startup")
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("$startup\MedStock Pro.lnk")
$sc.TargetPath = "C:\Program Files\MedStock Pro\MedStock Pro.exe"  # adjust to the installed path
$sc.Save()
```

To disable, delete `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MedStock Pro.lnk`
or toggle it off in **Task Manager → Startup apps**.

The backend starts on boot via the Windows Service (§8), so the desktop app
finds it ready.

---

## 10.5 Multi-computer clinic setup (server + client PCs)

All computers share the **same live data** because there is only one backend and
one database — on the main computer. Client PCs just run the app and point at it.

### Step 1 — Finish the MAIN computer

Complete §6–§9 on the main computer (backend service running, firewall opened in
§8.1, licence activated). Leave its own app server address as
`http://localhost:5218` (it is both server and a client of itself).

### Step 2 — Find the main computer's LAN IP address

On the **main computer**, open PowerShell:

```powershell
ipconfig | Select-String "IPv4"
```

Note the address on the clinic network, e.g. `192.168.1.50`. (A fixed/reserved
IP is best — ask the router to reserve it so it doesn't change. If it changes,
just update the client address in Step 4.)

Test from a **client computer** that it can reach the main one:

```powershell
curl http://192.168.1.50:5218/api/license/status
```

You should get a JSON response. If it times out: the main PC is off, the
firewall rule (§8.1) is missing, or they are on different networks.

### Step 3 — Install the app on each client computer

On each staff computer:

1. Run **only** the desktop installer `MedStock Pro_x.x.x_x64-setup.exe`.
   Do **not** copy the backend, database, or any data to client PCs.
2. Launch the app.

### Step 4 — Point the client at the main computer

On first launch the client can't reach a backend and shows:

> *Cannot connect to MedStock Pro server. Please make sure the main clinic
> computer is on.*

In the **Main computer server address** box, enter the main computer's address
from Step 2, e.g. `http://192.168.1.50:5218`, and click **Save & connect**. The
app connects and shows the normal login. (You can change it later in
**Settings → Server connection**.)

> Prefer to pre-configure clients at build time instead of typing the address?
> Create `frontend/medstockpro-frontend/.env.production`, set
> `VITE_API_BASE_URL` to the main computer, and run
> `npm run tauri build`. Every client built this way defaults to that server.

Client PCs do **not** need a licence key — the licence lives on the main
computer's backend, which all clients use.

### Step 5 — Test live data sharing

1. On the **main computer**, sign in and note a product's stock (or scan it to
   change stock).
2. On a **client computer**, open the same product / refresh the list.
3. The change appears — because both read the same database on the main PC.
   (Client screens refresh on navigation; reopen the page or list to pull the
   latest.)

### Step 6 — Confirm the copy-protection works

The licence is bound to the main computer. To prove a stolen copy is useless:

1. Copy `C:\ProgramData\MedStockPro\Database\medstockpro.db` to a **different**
   computer that also has the backend installed, into the same path.
2. Start the backend there and open the app.
3. It shows: *"This installation is not licensed for this computer. Please
   contact the developer."* — the machine fingerprint does not match, so access
   is blocked even though the data is present.

---

## 11. Backup & restore the database

The live database is a single SQLite file:
`C:\ProgramData\MedStockPro\Database\medstockpro.db`.

**In-app backup** (recommended): sign in as Admin → **Settings/Backup** →
*Create backup*. Copies are written to
`C:\ProgramData\MedStockPro\Backups\` with a timestamped filename.

**Manual backup**: stop the backend service, then copy the whole
`C:\ProgramData\MedStockPro\` folder to external storage. Stopping first avoids
copying a half-written file:

```powershell
sc.exe stop MedStockProApi
Copy-Item "C:\ProgramData\MedStockPro" "D:\MedStock-Backup-$(Get-Date -f yyyyMMdd)" -Recurse
sc.exe start MedStockProApi
```

**Restore**:

```powershell
sc.exe stop MedStockProApi
Copy-Item "D:\MedStock-Backup-YYYYMMDD\Database\medstockpro.db" `
          "C:\ProgramData\MedStockPro\Database\medstockpro.db" -Force
sc.exe start MedStockProApi
```

> If you restore onto a **different** computer, the machine-locked licence will
> not match — re-activate with a fresh key (§9).

---

## 12. Upgrading the app later

1. Stop the service: `sc.exe stop MedStockProApi`.
2. Replace the backend publish folder with the new build (keep `appsettings.json`).
3. Start the service: `sc.exe start MedStockProApi`. Pending EF migrations apply
   automatically on startup — the ProgramData database and its data are untouched.
4. Re-run the Tauri installer for the new desktop version.

Data, licence, and settings persist across upgrades because they live in
`C:\ProgramData\MedStockPro\`, outside the app folder.

---

## Quick reference

| Item | Location / value (main computer) |
|---|---|
| Database | `C:\ProgramData\MedStockPro\Database\medstockpro.db` |
| Uploads (photos) | `C:\ProgramData\MedStockPro\Uploads\products\` |
| Backups | `C:\ProgramData\MedStockPro\Backups\` |
| Logs | `C:\ProgramData\MedStockPro\Logs\` |
| Backend service | `MedStockProApi` (Windows Service) |
| Backend bind | `http://0.0.0.0:5218` (all LAN interfaces) |
| Firewall rule | `MedStock Pro API` — TCP 5218, Private profile |
| Main computer URL for clients | `http://<main-ip>:5218` (e.g. `192.168.1.50`) |
| Client server setting | in-app **Settings → Server connection**, or `VITE_API_BASE_URL` at build |
| JWT key | `JWT__KEY` machine environment variable (main PC only) |
| Licence public key | `appsettings.json → License:PublicKey` |
| Licence private key | **developer only**, never on clinic PC |

**Client PCs** hold no database, no backend, no licence — only the app pointed
at the main computer's address.
