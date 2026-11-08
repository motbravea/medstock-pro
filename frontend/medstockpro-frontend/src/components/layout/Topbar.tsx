import { LogOut, Moon, Search, Sun } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { useHotkey } from "../../hooks/useHotkey";
import { navItems } from "./nav";
import { NotificationsPopover } from "./NotificationsPopover";
import { Avatar } from "../ui/Avatar";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const route = useUIStore((s) => s.route);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const current = navItems.find((item) => item.key === route);

  useHotkey("mod+k", (event) => {
    event.preventDefault();
    setCommandPaletteOpen(true);
  });

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-subtle bg-surface px-6">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold tracking-tight text-default">
          {current?.label ?? "Dashboard"}
        </h2>
        <p className="text-[11px] text-muted">
          {today}
          {current?.description ? ` · ${current.description}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden h-10 w-72 items-center gap-2 rounded-xl border border-subtle bg-surface px-3 text-sm text-muted transition hover:bg-muted md:flex"
        >
          <Search size={16} />
          <span className="flex-1 text-left">Search or jump to...</span>
          <kbd className="rounded border border-subtle bg-muted px-1.5 py-px text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-subtle bg-surface text-muted transition hover:bg-muted hover:text-default"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationsPopover />

        <div className="flex items-center gap-2.5 rounded-xl border border-subtle bg-surface px-2.5 py-1.5">
          <Avatar name={user?.fullName ?? ""} size="sm" />
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold leading-tight text-default">
              {user?.fullName}
            </p>
            <p className="text-[10px] leading-tight text-muted">
              {user?.role}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex h-10 items-center gap-2 rounded-xl border border-subtle bg-surface px-3 text-sm font-medium text-muted transition hover:bg-muted hover:text-default"
        >
          <LogOut size={16} />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
