import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FolderTree, Plus, Tags, Trash2 } from "lucide-react";
import { categoryService } from "../services/categoryService";
import { useAuthStore } from "../stores/authStore";
import { toast } from "../stores/toastStore";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Input, Textarea } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { CategoryDetailDrawer } from "../components/categories/CategoryDetailDrawer";
import type { Category, CategoryRequest } from "../types";

export function CategoriesPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  // Click a card → open the detail drawer with linked products.
  const [selected, setSelected] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryService.list,
  });

  const remove = useMutation({
    mutationFn: (id: number) => categoryService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category removed");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed";
      toast.error("Failed", message);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Taxonomy"
        title="Categories"
        description="Group products into clinical categories like Anesthetics or PPE."
        actions={
          isAdmin ? (
            <Button
              leadingIcon={<Plus size={16} />}
              onClick={() => setCreating(true)}
            >
              New category
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree size={20} />}
          title="No categories yet"
          description="Categories help filter products and break down reports."
          action={
            isAdmin ? (
              <Button onClick={() => setCreating(true)}>Add category</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category, i) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.02 }}
            >
              <Card
                hoverable
                className="h-full cursor-pointer"
                onClick={() => setSelected(category)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-900)]/40 dark:text-[var(--color-brand-300)]">
                      <Tags size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-default">
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="mt-0.5 text-xs text-muted line-clamp-2">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-4 flex justify-end gap-2 border-t border-subtle pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditing(category);
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
                        setDeleting(category);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        category={null}
      />
      <CategoryFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        category={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting ? remove.mutateAsync(deleting.id) : Promise.resolve()
        }
        title="Delete this category?"
        description={
          deleting
            ? `${deleting.name} will be deactivated. Products keep their existing references.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
      />
      <CategoryDetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        category={selected}
      />
    </div>
  );
}

function CategoryFormDialog({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
}) {
  const editing = Boolean(category);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CategoryRequest>({
    name: "",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      category
        ? { name: category.name, description: category.description }
        : { name: "", description: "" },
    );
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: () => {
      if (editing && category) return categoryService.update(category.id, form);
      return categoryService.create(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editing ? "Category updated" : "Category added");
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
      title={editing ? "Edit category" : "New category"}
      size="sm"
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
          placeholder="e.g. Anesthetics"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Textarea
          label="Description"
          rows={3}
          placeholder="What does this category contain?"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </div>
    </Dialog>
  );
}
