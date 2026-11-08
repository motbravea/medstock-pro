import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Search, CornerDownLeft } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { navItems } from "./nav";
import { productService } from "../../services/productService";
import { useDebounce } from "../../hooks/useDebounce";
import { cn } from "../../lib/cn";

type Item = {
  id: string;
  type: "nav" | "product";
  label: string;
  description?: string;
  onSelect: () => void;
};

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setRoute = useUIStore((s) => s.setRoute);
  const isAdmin = useAuthStore((s) => s.user?.role === "Admin");

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounced = useDebounce(query, 180);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navHits: Item[] = useMemo(() => {
    const filter = (debounced || "").toLowerCase();
    return navItems
      .filter((item) => !item.adminOnly || isAdmin)
      .filter(
        (item) =>
          !filter ||
          item.label.toLowerCase().includes(filter) ||
          item.description?.toLowerCase().includes(filter),
      )
      .map((item) => ({
        id: `nav-${item.key}`,
        type: "nav" as const,
        label: item.label,
        description: item.description,
        onSelect: () => {
          setRoute(item.key);
          setOpen(false);
        },
      }));
  }, [debounced, isAdmin, setRoute, setOpen]);

  const { data: productHits = [] } = useQuery({
    queryKey: ["search", "products", debounced],
    queryFn: () => productService.search(debounced),
    enabled: debounced.trim().length > 1,
    staleTime: 30_000,
  });

  const productItems: Item[] = productHits.slice(0, 6).map((product) => ({
    id: `product-${product.id}`,
    type: "product" as const,
    label: product.name,
    description: `Stock ${product.currentStock} • ${product.internalBarcode || "no barcode"}`,
    onSelect: () => {
      setRoute("products");
      setOpen(false);
    },
  }));

  const items = [...navHits, ...productItems];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.onSelect();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-[14vh] mx-auto w-full max-w-xl px-4">
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-pop"
            >
              <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
                <Search size={18} className="text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onKey}
                  placeholder="Search products, jump to a page..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
                />
                <kbd className="hidden rounded-md border border-subtle bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
                  esc
                </kbd>
              </div>

              <div className="max-h-[420px] overflow-y-auto scroll-slim py-2">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    No matches.{" "}
                    {debounced ? "Try a different search." : "Start typing to search."}
                  </p>
                ) : (
                  <ul className="space-y-0.5 px-2">
                    {items.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={item.onSelect}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                            activeIndex === index
                              ? "bg-muted text-default"
                              : "text-muted hover:bg-muted hover:text-default",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-default">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="truncate text-xs text-muted">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="rounded-md border border-subtle bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                            {item.type === "nav" ? "Go to" : "Product"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-subtle bg-muted px-3 py-2 text-[11px] text-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-subtle bg-surface px-1 py-px text-[10px]">
                      ↑
                    </kbd>
                    <kbd className="rounded border border-subtle bg-surface px-1 py-px text-[10px]">
                      ↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft size={11} />
                    Select
                  </span>
                </div>
                <span>MedStock Pro</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
