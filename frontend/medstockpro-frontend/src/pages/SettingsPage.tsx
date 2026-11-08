import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Database,
  DatabaseBackup,
  Download,
  Moon,
  Palette,
  Server,
  ShieldCheck,
  Sun,
  User2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { playSound } from "../lib/sound";
import { backupService } from "../services/backupService";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { toast } from "../stores/toastStore";
import {
  ApiError,
  clearApiBaseUrl,
  getServerOrigin,
  setApiBaseUrl,
} from "../lib/api";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Switch } from "../components/ui/Switch";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { RoleBadge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { formatDate, formatDateTime } from "../lib/format";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const setSoundEnabled = useUIStore((s) => s.setSoundEnabled);
  const isAdmin = user?.role === "Admin";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Profile, appearance, and admin tools."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" description="Your active session." />
          <div className="flex items-center gap-3">
            <Avatar name={user?.fullName ?? ""} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-default">
                {user?.fullName}
              </p>
              <p className="text-xs text-muted">@{user?.username}</p>
              <div className="mt-1">
                {user && <RoleBadge role={user.role} />}
              </div>
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted flex items-center gap-2">
                <ShieldCheck size={13} />
                Status
              </dt>
              <dd className="text-default">
                {user?.isActive ? "Active" : "Inactive"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted flex items-center gap-2">
                <User2 size={13} />
                User ID
              </dt>
              <dd className="text-default tabular">#{user?.id}</dd>
            </div>
          </dl>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader
            title="Appearance"
            description="Switch between light and dark mode."
          />
          <div className="grid grid-cols-2 gap-3">
            <ThemePreview
              kind="light"
              active={theme === "light"}
              onClick={theme === "dark" ? toggleTheme : () => {}}
            />
            <ThemePreview
              kind="dark"
              active={theme === "dark"}
              onClick={theme === "light" ? toggleTheme : () => {}}
            />
          </div>

          <div className="mt-5 rounded-xl border border-subtle bg-muted p-3">
            <Switch
              checked={theme === "dark"}
              onChange={toggleTheme}
              label="Dark mode"
              description="Quick toggle for the current session."
            />
          </div>
        </Card>
      </div>

      {/* Sound & feedback */}
      <Card>
        <CardHeader
          title="Sound & feedback"
          description="Audible cues for scans, alerts, and saves. Saved to this device."
        />
        <div className="rounded-xl border border-subtle bg-muted p-3">
          <Switch
            checked={soundEnabled}
            onChange={(next) => {
              setSoundEnabled(next);
              if (next) playSound("notify");
            }}
            label={
              <span className="inline-flex items-center gap-2">
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                Sound effects
              </span>
            }
            description="Plays subtle beeps on successful scans, errors, and new alerts."
          />
        </div>
      </Card>

      {/* Server connection — per device */}
      <ServerConnectionSection />

      {/* Backup section — admin only */}
      {isAdmin && <BackupSection />}
    </div>
  );
}

function ServerConnectionSection() {
  const [url, setUrl] = useState(getServerOrigin());
  const current = getServerOrigin();
  const isDefault = /localhost/i.test(current);

  function save() {
    const normalized = setApiBaseUrl(url);
    toast.success(
      "Server address saved",
      "Reconnecting to " + normalized.replace(/\/api$/i, ""),
    );
    // Reload so every query targets the new server with a clean cache.
    setTimeout(() => window.location.reload(), 600);
  }

  function reset() {
    clearApiBaseUrl();
    toast.info("Reset to this computer", "Using http://localhost:5218");
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <Card>
      <CardHeader
        title="Server connection"
        description="Where this computer reads and saves clinic data. Set once per device."
      />
      <div className="rounded-xl border border-subtle bg-muted p-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Server size={14} />
          <span>
            Currently connected to{" "}
            <span className="font-mono text-default">{current}</span>
            {isDefault && " (this computer)"}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.50:5218"
            className="font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={save}>Save &amp; reconnect</Button>
            {!isDefault && (
              <Button variant="secondary" onClick={reset}>
                Use this PC
              </Button>
            )}
          </div>
        </div>

        <p className="mt-2 text-[11px] text-subtle">
          Main clinic computer: leave as{" "}
          <span className="font-mono">http://localhost:5218</span>. Client
          computers: enter the main computer's address, e.g.{" "}
          <span className="font-mono">http://192.168.1.50:5218</span>.
        </p>
      </div>
    </Card>
  );
}

function ThemePreview({
  kind,
  active,
  onClick,
}: {
  kind: "light" | "dark";
  active: boolean;
  onClick: () => void;
}) {
  const isDark = kind === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-stretch overflow-hidden rounded-xl border text-left transition ${
        active
          ? "border-[var(--color-brand-700)] ring-brand"
          : "border-subtle hover:bg-muted"
      }`}
    >
      <div
        className={`flex h-24 items-end gap-1 p-2 ${
          isDark ? "bg-slate-900" : "bg-stone-50"
        }`}
      >
        <div
          className={`h-2 w-3 rounded ${
            isDark ? "bg-slate-700" : "bg-slate-300"
          }`}
        />
        <div className="flex-1 space-y-1">
          <div
            className={`h-2 rounded ${
              isDark ? "bg-slate-700" : "bg-slate-200"
            }`}
          />
          <div
            className={`h-6 rounded ${
              isDark ? "bg-teal-700/40" : "bg-teal-100"
            }`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-subtle bg-surface px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-default">
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
          {isDark ? "Dark" : "Light"}
        </span>
        {active && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-700)] dark:text-[var(--color-brand-300)]">
            Active
          </span>
        )}
      </div>
    </button>
  );
}

function BackupSection() {
  const queryClient = useQueryClient();

  const { data: info, isLoading } = useQuery({
    queryKey: ["backup", "info"],
    queryFn: backupService.info,
  });

  const create = useMutation({
    mutationFn: backupService.create,
    onSuccess: (data) => {
      toast.success("Backup created", data.backupFileName);
      queryClient.invalidateQueries({ queryKey: ["backup", "info"] });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Backup failed", message);
    },
  });

  return (
    <Card>
      <CardHeader
        title="Database backup"
        description="Snapshot the SQLite database to a timestamped file."
        action={
          <Button
            leadingIcon={<Download size={14} />}
            onClick={() => create.mutate()}
            loading={create.isPending}
          >
            Create backup
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !info ? null : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoTile
            icon={<Database size={16} />}
            label="Database path"
            value={
              <span className="break-all font-mono text-[11px]">
                {info.databasePath}
              </span>
            }
          />
          <InfoTile
            icon={<Palette size={16} />}
            label="Size"
            value={`${info.fileSizeKb.toLocaleString()} KB`}
          />
          <InfoTile
            icon={<DatabaseBackup size={16} />}
            label="Last modified"
            value={info.lastModified ? formatDateTime(info.lastModified) : "—"}
          />
        </div>
      )}

      <p className="mt-4 text-[11px] text-subtle">
        Backups are saved server-side under the API's <code className="rounded bg-muted px-1 py-px font-mono">Backups/</code>{" "}
        folder · {formatDate(new Date())}.
      </p>
    </Card>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-subtle bg-muted p-3">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </p>
      </div>
      <div className="mt-1 text-sm text-default">{value}</div>
    </div>
  );
}
