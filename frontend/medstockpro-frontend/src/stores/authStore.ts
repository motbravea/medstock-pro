import { create } from "zustand";
import { TOKEN_KEY, USER_KEY } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { LoggedInUser } from "../types";

type AuthState = {
  user: LoggedInUser | null;
  token: string | null;
  hydrated: boolean;
  isAdmin: () => boolean;
  signIn: (user: LoggedInUser, token: string) => void;
  signOut: () => void;
  hydrate: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,

  isAdmin: () => get().user?.role === "Admin",

  signIn: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, token, hydrated: true });
  },

  signOut: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Drop every cached query so the next user (e.g. Staff) never sees the
    // previous user's (e.g. Admin) data flash on screen.
    queryClient.cancelQueries();
    queryClient.clear();
    set({ user: null, token: null, hydrated: true });
  },

  hydrate: () => {
    if (get().hydrated) return;

    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    let user: LoggedInUser | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as LoggedInUser;
      } catch {
        user = null;
      }
    }
    set({
      token: token ?? null,
      user: token && user ? user : null,
      hydrated: true,
    });
  },
}));

// Automatically log out when any request returns 401.
if (typeof window !== "undefined") {
  window.addEventListener("medstock:unauthorized", () => {
    const state = useAuthStore.getState();
    if (state.user) state.signOut();
  });
}
