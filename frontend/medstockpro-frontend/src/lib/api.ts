/**
 * MedStock Pro API client.
 *
 * - Reads JWT from localStorage on every call.
 * - Attaches it as Bearer token.
 * - Throws an ApiError carrying the parsed body when the response is not OK.
 * - On 401, dispatches a window event so the auth store can sign the user out.
 */

/**
 * Backend API base URL resolution (client/server clinic setup).
 *
 * The desktop app can run on the MAIN clinic computer (backend local) or on a
 * CLIENT computer that talks to the main computer over the LAN. The base URL
 * is resolved at runtime, in priority order:
 *   1. localStorage "medstock_api_base"  — set in-app on each client PC.
 *   2. build-time VITE_API_BASE_URL       — bake a fixed server URL at build.
 *   3. default http://localhost:5218/api  — main computer / development.
 *
 * Nothing hardcodes localhost as the *only* option, so a client can point at
 * e.g. http://192.168.1.50:5218/api without a rebuild.
 */
const DEFAULT_API_BASE = "http://localhost:5218/api";
export const API_BASE_KEY = "medstock_api_base";

/** Normalise any user-entered server URL to a proper "…/api" base. */
export function normalizeApiBase(input: string): string {
  let value = (input ?? "").trim();
  if (!value) return DEFAULT_API_BASE;
  // Add a scheme if the user typed a bare host/ip[:port].
  if (!/^https?:\/\//i.test(value)) value = "http://" + value;
  value = value.replace(/\/+$/, ""); // drop trailing slashes
  if (!/\/api$/i.test(value)) value += "/api";
  return value;
}

export function getApiBaseUrl(): string {
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem(API_BASE_KEY)
    : null;
  if (stored && stored.trim()) return stored.trim();

  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return normalizeApiBase(envUrl);

  return DEFAULT_API_BASE;
}

export function setApiBaseUrl(input: string): string {
  const normalized = normalizeApiBase(input);
  localStorage.setItem(API_BASE_KEY, normalized);
  return normalized;
}

export function clearApiBaseUrl(): void {
  localStorage.removeItem(API_BASE_KEY);
}

/** Human-readable server origin (no /api) for display in settings/errors. */
export function getServerOrigin(): string {
  return getApiBaseUrl().replace(/\/api$/i, "");
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export const TOKEN_KEY = "medstock_token";
export const USER_KEY = "medstock_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Send `body` as raw text/FormData instead of JSON-stringifying it. */
  raw?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  let url = `${getApiBaseUrl()}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  if (qs) url += (path.includes("?") ? "&" : "?") + qs;
  return url;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, raw, headers, ...rest } = options;
  const token = getStoredToken();

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (raw) {
      payload = body as BodyInit;
    } else {
      finalHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body: payload,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("medstock:unauthorized"));
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      (isJson && data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : typeof data === "string" && data
          ? data
          : `Request failed (${response.status})`) || "Request failed";

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),

  /** Upload one file via multipart/form-data. */
  upload: <T>(path: string, fieldName: string, file: File) => {
    const form = new FormData();
    form.append(fieldName, file);
    return request<T>(path, { method: "POST", body: form, raw: true });
  },
};
