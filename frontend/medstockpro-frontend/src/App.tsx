import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { useUIStore } from "./stores/uiStore";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./components/layout/AppShell";
import { ToastViewport } from "./components/ui/Toast";
import { LicenseGate } from "./components/LicenseGate";

export default function App() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateUI = useUIStore((s) => s.hydrateUI);

  useEffect(() => {
    hydrateUI();
    hydrateAuth();
  }, [hydrateAuth, hydrateUI]);

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-app">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--bg-muted)]" />
      </main>
    );
  }

  // Licence check gates the entire app — login is only reachable once the
  // installation is activated and bound to this machine.
  return (
    <>
      <LicenseGate>{user ? <AppShell /> : <LoginPage />}</LicenseGate>
      <ToastViewport />
    </>
  );
}
