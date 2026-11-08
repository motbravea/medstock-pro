import { create } from "zustand";
import { isSoundOn, setSoundOn } from "../lib/sound";

export type RouteKey =
  | "dashboard"
  | "products"
  | "scan"
  | "receive"
  | "suppliers"
  | "categories"
  | "reports"
  | "alerts"
  | "approvals"
  | "users"
  | "audit"
  | "settings";

type Theme = "light" | "dark";

type UIState = {
  route: RouteKey;
  sidebarCollapsed: boolean;
  theme: Theme;
  commandPaletteOpen: boolean;
  soundEnabled: boolean;
  setRoute: (route: RouteKey) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  hydrateUI: () => void;
};

const THEME_KEY = "medstock_theme";
const SIDEBAR_KEY = "medstock_sidebar";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useUIStore = create<UIState>((set, get) => ({
  route: "dashboard",
  sidebarCollapsed: false,
  theme: "light",
  commandPaletteOpen: false,
  soundEnabled: true,

  setRoute: (route) => set({ route }),

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem(SIDEBAR_KEY, String(next));
    set({ sidebarCollapsed: next });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    set({ theme: next });
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setSoundEnabled: (enabled) => {
    setSoundOn(enabled);
    set({ soundEnabled: enabled });
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    setSoundOn(next);
    set({ soundEnabled: next });
  },

  hydrateUI: () => {
    const storedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    const sidebarRaw = localStorage.getItem(SIDEBAR_KEY);
    const sidebarCollapsed = sidebarRaw === "true";
    applyTheme(storedTheme);
    set({
      theme: storedTheme,
      sidebarCollapsed,
      soundEnabled: isSoundOn(),
    });
  },
}));
