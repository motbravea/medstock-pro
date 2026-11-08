import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { navItems } from "./nav";
import { cn } from "../../lib/cn";
import logoIcon from "../../assets/medstockpro-icon.png";
import { Tooltip } from "../ui/Tooltip";
import { pendingMovementService } from "../../services/pendingMovementService";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const route = useUIStore((s) => s.route);
  const setRoute = useUIStore((s) => s.setRoute);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const isAdmin = user?.role === "Admin";
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Lightweight poll for the "Approvals: N" badge. Admin only — the endpoint
  // is 401 for Staff and we'd otherwise spam the network log.
  const pendingCount = useQuery({
    queryKey: ["pendingMovementCount"],
    queryFn: () => pendingMovementService.count(),
    enabled: isAdmin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const badgeCounts: Partial<Record<string, number>> = {
    approvals: pendingCount.data?.pending ?? 0,
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex shrink-0 flex-col border-r border-subtle bg-surface"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-4",
          collapsed && "justify-center px-2",
        )}
      >
        <img
          src={logoIcon}
          alt="MedStock Pro"
          className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-default">
              MedStock Pro
            </p>
            <p className="text-[11px] text-muted">Dental Inventory</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = route === item.key;
          const badge = badgeCounts[item.key] ?? 0;

          const button = (
            <button
              key={item.key}
              type="button"
              onClick={() => setRoute(item.key)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "nav-active"
                  : "text-muted hover:bg-muted hover:text-default",
                collapsed && "justify-center px-2",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 -z-10 rounded-xl"
                  style={{
                    background:
                      "color-mix(in oklab, var(--color-brand-700) 12%, transparent)",
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              )}
              <Icon size={18} strokeWidth={1.7} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {badge > 0 && !collapsed && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {badge > 0 && collapsed && (
                <span className="absolute top-1 right-1 inline-flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-surface" />
              )}
            </button>
          );

          return collapsed ? (
            <Tooltip
              key={item.key}
              content={
                badge > 0 ? `${item.label} · ${badge} pending` : item.label
              }
              side="right"
            >
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </nav>

      <div className="p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-muted hover:text-default transition",
            collapsed && "justify-center px-2",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight size={16} />
          ) : (
            <>
              <ChevronsLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
