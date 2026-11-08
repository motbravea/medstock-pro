# MedStock Pro frontend

React and TypeScript interface for MedStock Pro, with a Tauri desktop wrapper.

See the [project README](../../README.md) for the architecture, API setup, activation requirements, and build status.

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

The API defaults to `http://localhost:5218/api`. Change the connection in the application settings, or set `VITE_API_BASE_URL` when building a client.

For a packaged Windows desktop client, install the Rust and Windows C++ prerequisites, then run `npm run tauri build`. See [INSTALLATION.md](../../INSTALLATION.md) for deployment details.
