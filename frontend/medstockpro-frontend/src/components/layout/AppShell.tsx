import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUIStore } from "../../stores/uiStore";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { DashboardPage } from "../../pages/DashboardPage";
import { ProductsPage } from "../../pages/ProductsPage";
import { ScanPage } from "../../pages/ScanPage";
import { ReceivePage } from "../../pages/ReceivePage";
import { SuppliersPage } from "../../pages/SuppliersPage";
import { CategoriesPage } from "../../pages/CategoriesPage";
import { ReportsPage } from "../../pages/ReportsPage";
import { AlertsPage } from "../../pages/AlertsPage";
import { PendingApprovalsPage } from "../../pages/PendingApprovalsPage";
import { UsersPage } from "../../pages/UsersPage";
import { AuditLogsPage } from "../../pages/AuditLogsPage";
import { SettingsPage } from "../../pages/SettingsPage";
import type { RouteKey } from "../../stores/uiStore";

const pageComponents: Record<RouteKey, ComponentType> = {
  dashboard: DashboardPage,
  products: ProductsPage,
  scan: ScanPage,
  receive: ReceivePage,
  suppliers: SuppliersPage,
  categories: CategoriesPage,
  reports: ReportsPage,
  alerts: AlertsPage,
  approvals: PendingApprovalsPage,
  users: UsersPage,
  audit: AuditLogsPage,
  settings: SettingsPage,
};

export function AppShell() {
  const route = useUIStore((s) => s.route);
  const PageComponent = pageComponents[route];

  return (
    <div className="flex h-screen overflow-hidden bg-app text-default">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto scroll-slim">
          <AnimatePresence mode="wait">
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto w-full max-w-[1400px] px-8 py-8"
            >
              <PageComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
