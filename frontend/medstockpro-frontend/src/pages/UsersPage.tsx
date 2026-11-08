import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Edit3,
  KeyRound,
  LockKeyhole,
  Plus,
  Power,
  ShieldAlert,
  User,
} from "lucide-react";
import { userService } from "../services/userService";
import { useAuthStore } from "../stores/authStore";
import { toast } from "../stores/toastStore";
import { ApiError } from "../lib/api";
import { playSound } from "../lib/sound";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Input, Select } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { RoleBadge, Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate } from "../lib/format";
import type {
  ChangePasswordRequest,
  CreateUserRequest,
  Role,
  UpdateUserRequest,
  UserSummary,
} from "../types";

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "Admin";

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [togglingActive, setTogglingActive] = useState<UserSummary | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: userService.list,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert size={22} />}
        title="Admins only"
        description="User management is restricted to clinic owners."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Users"
        description="Manage clinic owner and staff accounts."
        actions={
          <Button
            leadingIcon={<Plus size={16} />}
            onClick={() => setCreating(true)}
          >
            Invite user
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<User size={20} />}
          title="No users yet"
          description="Invite staff members to start tracking who uses what."
          action={<Button onClick={() => setCreating(true)}>Invite user</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.02 }}
            >
              <UserCard
                user={user}
                isSelf={user.id === currentUser?.id}
                onEdit={() => setEditing(user)}
                onResetPassword={() => setResetting(user)}
                onToggleActive={() => setTogglingActive(user)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <UserCreateDialog open={creating} onClose={() => setCreating(false)} />
      <UserEditDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        user={editing}
        isSelf={editing?.id === currentUser?.id}
      />
      <PasswordResetDialog
        open={resetting !== null}
        onClose={() => setResetting(null)}
        user={resetting}
      />
      <ToggleActiveConfirm
        open={togglingActive !== null}
        onClose={() => setTogglingActive(null)}
        user={togglingActive}
        isSelf={togglingActive?.id === currentUser?.id}
      />
    </div>
  );
}

function UserCard({
  user,
  isSelf,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  user: UserSummary;
  isSelf: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Card hoverable className="h-full">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-default">
              {user.fullName}
            </p>
            {isSelf && <Badge tone="info">You</Badge>}
          </div>
          <p className="truncate text-xs text-muted">@{user.username}</p>
          <div className="mt-2 flex items-center gap-2">
            <RoleBadge role={user.role} />
            {!user.isActive && <Badge tone="neutral">Inactive</Badge>}
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Joined {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-subtle pt-3">
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Edit3 size={13} />}
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<KeyRound size={13} />}
          onClick={onResetPassword}
        >
          Password
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Power size={13} />}
          onClick={onToggleActive}
          className={
            user.isActive
              ? "text-red-600 hover:text-red-700"
              : "text-emerald-700 hover:text-emerald-800"
          }
          disabled={isSelf && user.isActive}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </Card>
  );
}

// ─── Create dialog (unchanged from the previous Invite flow) ──────────────
function UserCreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserRequest>({
    fullName: "",
    username: "",
    password: "",
    role: "Staff",
  });

  useEffect(() => {
    if (open) {
      setForm({ fullName: "", username: "", password: "", role: "Staff" });
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => userService.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created", `${form.fullName} can now sign in.`);
      playSound("saveOk");
      onClose();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Could not create user", message);
      playSound("saveError");
    },
  });

  const canSubmit =
    form.fullName.trim() && form.username.trim() && form.password.length >= 6;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a user"
      description="Create login credentials for a clinic team member."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            Create user
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full name"
          placeholder="Dr. Sarah Adams"
          value={form.fullName}
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
          leadingIcon={<User size={15} />}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Username"
            placeholder="sarah"
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as Role })
            }
            options={[
              { value: "Staff", label: "Staff — record stock movements" },
              { value: "Admin", label: "Admin — full access" },
            ]}
          />
        </div>

        <Input
          label="Temporary password"
          type="password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
          leadingIcon={<LockKeyhole size={15} />}
          hint="Share this with the user — they can change it later."
        />
      </div>
    </Dialog>
  );
}

// ─── Edit dialog (full name, username, role — never password) ─────────────
function UserEditDialog({
  open,
  onClose,
  user,
  isSelf,
}: {
  open: boolean;
  onClose: () => void;
  user: UserSummary | null;
  isSelf: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateUserRequest>({
    fullName: "",
    username: "",
    role: "Staff",
  });

  useEffect(() => {
    if (open && user) {
      setForm({
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      });
    }
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return userService.update(user.id, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      playSound("saveOk");
      onClose();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Could not update user", message);
      playSound("saveError");
    },
  });

  if (!user) return null;

  const canSubmit = form.fullName.trim() && form.username.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${user.fullName}`}
      description="Update profile details. Use the Password button to change the password."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
          leadingIcon={<User size={15} />}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Username"
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as Role })
            }
            disabled={isSelf}
            hint={
              isSelf
                ? "You cannot change your own role. Ask another admin."
                : undefined
            }
            options={[
              { value: "Staff", label: "Staff — record stock movements" },
              { value: "Admin", label: "Admin — full access" },
            ]}
          />
        </div>
      </div>
    </Dialog>
  );
}

// ─── Password reset dialog ────────────────────────────────────────────────
function PasswordResetDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserSummary | null;
}) {
  const [form, setForm] = useState<ChangePasswordRequest>({ password: "" });

  useEffect(() => {
    if (open) setForm({ password: "" });
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return userService.changePassword(user.id, form);
    },
    onSuccess: () => {
      toast.success("Password updated", `Share the new password with ${user?.fullName}.`);
      playSound("saveOk");
      onClose();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Could not change password", message);
      playSound("saveError");
    },
  });

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Set a new password for ${user.fullName}`}
      description="Only the new password is needed. The old one is irrelevant."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={form.password.length < 6}
            onClick={() => mutation.mutate()}
          >
            Update password
          </Button>
        </>
      }
    >
      <Input
        label="New password"
        type="password"
        placeholder="At least 6 characters"
        value={form.password}
        onChange={(event) =>
          setForm({ ...form, password: event.target.value })
        }
        leadingIcon={<LockKeyhole size={15} />}
        autoComplete="new-password"
      />
    </Dialog>
  );
}

// ─── Activate / Deactivate confirm ────────────────────────────────────────
function ToggleActiveConfirm({
  open,
  onClose,
  user,
  isSelf,
}: {
  open: boolean;
  onClose: () => void;
  user: UserSummary | null;
  isSelf: boolean;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return user.isActive
        ? userService.deactivate(user.id)
        : userService.activate(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(user?.isActive ? "User deactivated" : "User activated");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Failed", message);
    },
  });

  if (!user) return null;

  const isDeactivating = user.isActive;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => mutation.mutateAsync()}
      title={
        isDeactivating ? `Deactivate ${user.fullName}?` : `Activate ${user.fullName}?`
      }
      description={
        isSelf && isDeactivating
          ? "You cannot deactivate your own account. The backend will reject this."
          : isDeactivating
            ? `${user.fullName} will no longer be able to sign in. You can reactivate them later.`
            : `${user.fullName} will be able to sign in again.`
      }
      confirmLabel={isDeactivating ? "Deactivate" : "Activate"}
      tone={isDeactivating ? "danger" : "primary"}
    />
  );
}
