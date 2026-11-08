import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Server, ShieldAlert, ShieldCheck } from "lucide-react";
import { licenseService } from "../services/licenseService";
import { ApiError, getServerOrigin, setApiBaseUrl } from "../lib/api";
import type { LicenseStatus } from "../types";

/**
 * Wraps the whole app. Reads the licence status once at boot:
 *   - Active           → render the app.
 *   - Unlicensed       → show the activation form.
 *   - Mismatch/Expired/Inactive → show the block page.
 *   - Backend offline  → show a retry page (not a licence failure).
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["license-status"],
    queryFn: () => licenseService.status(),
    retry: false,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-600)]" />
        <p className="mt-3 text-sm text-muted">Checking licence…</p>
      </Centered>
    );
  }

  // Network / backend-down: not a licence problem — the main computer may be
  // off or the server URL wrong. Show the exact message + a way to set it.
  if (query.isError) {
    return (
      <ServerConnectionScreen
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const status = query.data!;
  if (status.state === "Active") {
    return <>{children}</>;
  }

  return <LicenseScreen status={status} />;
}

function LicenseScreen({ status }: { status: LicenseStatus }) {
  // Unlicensed → offer activation. Any other non-active state is a hard block
  // (machine mismatch, expired, deactivated) and must not offer re-activation
  // on the wrong machine.
  if (status.state === "Unlicensed") {
    return <ActivationScreen />;
  }
  return <BlockedScreen status={status} />;
}

function ActivationScreen() {
  const queryClient = useQueryClient();
  const [clinicName, setClinicName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      licenseService.activate({ clinicName: clinicName.trim(), licenseKey: licenseKey.trim() }),
    onSuccess: () => {
      setError(null);
      // Re-read status; a successful activation flips the gate to the app.
      queryClient.invalidateQueries({ queryKey: ["license-status"] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? (err.body as { message?: string })?.message ?? err.message
          : "Activation failed. Check the key and try again.";
      setError(message);
    },
  });

  const canSubmit = clinicName.trim().length > 0 && licenseKey.trim().length > 8;

  return (
    <Centered>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-subtle bg-surface p-8 shadow-card"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-300)]">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-default">Activate MedStock Pro</h1>
            <p className="text-xs text-muted">
              Enter the licence details provided by the developer.
            </p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-default">
              Clinic name
            </label>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Exactly as issued"
              className="h-11 w-full rounded-xl border border-subtle bg-surface px-3 text-sm text-default outline-none focus:border-[var(--color-brand-700)] focus:ring-brand"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-default">
              Licence key
            </label>
            <textarea
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Paste the full licence key"
              rows={4}
              className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 font-mono text-xs text-default outline-none focus:border-[var(--color-brand-700)] focus:ring-brand"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-700)] text-sm font-medium text-white hover:bg-[var(--color-brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Activate this computer
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-subtle">
          The licence binds to this computer only.
        </p>
      </motion.div>
    </Centered>
  );
}

function BlockedScreen({ status }: { status: LicenseStatus }) {
  const queryClient = useQueryClient();
  return (
    <Centered>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-red-200 bg-surface p-8 text-center shadow-card dark:border-red-500/30"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
          <ShieldAlert size={24} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-default">
          This installation is not licensed for this computer.
        </h1>
        <p className="mt-2 text-sm text-muted">Please contact the developer.</p>

        <div className="mt-5 rounded-xl border border-subtle bg-muted px-4 py-3 text-left text-xs text-muted">
          <Row label="Status" value={friendlyState(status.state)} />
          {status.clinicName && <Row label="Clinic" value={status.clinicName} />}
          {status.expiresAt && (
            <Row label="Expires" value={status.expiresAt.slice(0, 10)} />
          )}
        </div>

        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["license-status"] })}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-subtle bg-surface px-4 py-2 text-sm font-medium text-default hover:bg-muted"
        >
          <ShieldCheck size={15} />
          Re-check licence
        </button>
      </motion.div>
    </Centered>
  );
}

function friendlyState(state: LicenseStatus["state"]): string {
  switch (state) {
    case "MachineMismatch":
      return "Licensed to a different computer";
    case "Expired":
      return "Licence expired";
    case "Inactive":
      return "Licence deactivated";
    default:
      return state;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-subtle">{label}</span>
      <span className="font-medium text-default">{value}</span>
    </div>
  );
}

/**
 * Shown when the backend can't be reached — the main clinic computer is off,
 * or this client is pointed at the wrong server address. Lets the user set the
 * server URL (stored per-device) and retry.
 */
function ServerConnectionScreen({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const [url, setUrl] = useState(getServerOrigin());

  function saveAndRetry() {
    setApiBaseUrl(url);
    onRetry();
  }

  return (
    <Centered>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-subtle bg-surface p-8 shadow-card"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <Server size={24} />
        </div>
        <h1 className="mt-4 text-center text-lg font-semibold text-default">
          Cannot connect to MedStock Pro server. Please make sure the main
          clinic computer is on.
        </h1>

        <div className="mt-6">
          <label className="mb-1 block text-xs font-medium text-default">
            Main computer server address
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.50:5218"
            className="h-11 w-full rounded-xl border border-subtle bg-surface px-3 font-mono text-sm text-default outline-none focus:border-[var(--color-brand-700)] focus:ring-brand"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] text-subtle">
            On the main computer this stays as{" "}
            <span className="font-mono">http://localhost:5218</span>. On a client
            computer, enter the main computer's address.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-subtle bg-surface text-sm font-medium text-default hover:bg-muted"
          >
            {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
            Try again
          </button>
          <button
            type="button"
            onClick={saveAndRetry}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-700)] text-sm font-medium text-white hover:bg-[var(--color-brand-800)]"
          >
            Save &amp; connect
          </button>
        </div>
      </motion.div>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-app px-4">
      <div className="flex flex-col items-center">{children}</div>
    </main>
  );
}
