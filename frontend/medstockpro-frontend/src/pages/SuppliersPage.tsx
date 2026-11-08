import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { supplierService } from "../services/supplierService";
import { useAuthStore } from "../stores/authStore";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../stores/toastStore";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Avatar } from "../components/ui/Avatar";
import { SupplierDetailDrawer } from "../components/suppliers/SupplierDetailDrawer";
import type { Supplier, SupplierRequest } from "../types";

export function SuppliersPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  // Selected supplier opens a detail drawer with linked products.
  const [selected, setSelected] = useState<Supplier | null>(null);
  const debounced = useDebounce(search, 180);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: supplierService.list,
  });

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter((supplier) =>
      `${supplier.name} ${supplier.email} ${supplier.phoneNumber} ${supplier.address}`
        .toLowerCase()
        .includes(q),
    );
  }, [suppliers, debounced]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplierService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier removed");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Failed", message);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Suppliers"
        description="Contacts and pricing partners for your inventory."
        actions={
          isAdmin ? (
            <Button
              leadingIcon={<Plus size={16} />}
              onClick={() => setCreating(true)}
            >
              Add supplier
            </Button>
          ) : null
        }
      />

      <div className="flex items-center gap-3">
        <div className="w-full md:max-w-md">
          <Input
            placeholder="Search suppliers"
            leadingIcon={<Search size={16} />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="text-xs text-muted tabular">
          {filtered.length} of {suppliers.length}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={20} />}
          title={suppliers.length === 0 ? "No suppliers yet" : "No matches"}
          description={
            suppliers.length === 0
              ? "Add your first supplier to track pricing and orders."
              : "Try a different search."
          }
          action={
            isAdmin && suppliers.length === 0 ? (
              <Button onClick={() => setCreating(true)}>Add supplier</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier, i) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.02 }}
            >
              <SupplierCard
                supplier={supplier}
                canEdit={isAdmin}
                onOpen={() => setSelected(supplier)}
                onEdit={() => setEditing(supplier)}
                onDelete={() => setDeleting(supplier)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        supplier={null}
      />
      <SupplierFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        supplier={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting ? deleteMutation.mutateAsync(deleting.id) : Promise.resolve()
        }
        title="Remove this supplier?"
        description={deleting ? `${deleting.name} will be deactivated.` : ""}
        confirmLabel="Remove"
        tone="danger"
      />
      <SupplierDetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        supplier={selected}
      />
    </div>
  );
}

function SupplierCard({
  supplier,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
}: {
  supplier: Supplier;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // The card body is clickable to open the detail drawer (linked products).
  // Edit/Remove live in the footer and stop event propagation so they don't
  // also open the drawer.
  return (
    <Card hoverable className="h-full cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <Avatar name={supplier.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-default">
            {supplier.name}
          </p>
          {supplier.notes && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {supplier.notes}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-xs">
        {supplier.phoneNumber && (
          <div className="flex items-center gap-2 text-muted">
            <Phone size={13} />
            <span className="tabular text-default">{supplier.phoneNumber}</span>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-muted">
            <Mail size={13} />
            <span className="text-default truncate">{supplier.email}</span>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2 text-muted">
            <MapPin size={13} />
            <span className="text-default truncate">{supplier.address}</span>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-subtle pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 size={13} />}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </Button>
        </div>
      )}
    </Card>
  );
}

function SupplierFormDialog({
  open,
  onClose,
  supplier,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(supplier);

  const [form, setForm] = useState<SupplierRequest>({
    name: "",
    phoneNumber: "",
    email: "",
    address: "",
    notes: "",
  });

  // Re-sync form on open
  useEffect(() => {
    if (!open) return;
    setForm(
      supplier
        ? {
            name: supplier.name,
            phoneNumber: supplier.phoneNumber,
            email: supplier.email,
            address: supplier.address,
            notes: supplier.notes,
          }
        : { name: "", phoneNumber: "", email: "", address: "", notes: "" },
    );
  }, [open, supplier]);

  const mutation = useMutation({
    mutationFn: () => {
      if (editing && supplier) return supplierService.update(supplier.id, form);
      return supplierService.create(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editing ? "Supplier updated" : "Supplier added");
      onClose();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Failed", message);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit supplier" : "New supplier"}
      description={
        editing ? "Update contact info and notes." : "Add a new supplier."
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!form.name.trim()}
            onClick={() => mutation.mutate()}
          >
            {editing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          leadingIcon={<Building2 size={15} />}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Phone"
            value={form.phoneNumber}
            onChange={(event) =>
              setForm({ ...form, phoneNumber: event.target.value })
            }
            leadingIcon={<Phone size={14} />}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            leadingIcon={<Mail size={14} />}
          />
        </div>
        <Input
          label="Address"
          value={form.address}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
          leadingIcon={<MapPin size={14} />}
        />
        <Textarea
          label="Notes"
          rows={3}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>
    </Dialog>
  );
}
