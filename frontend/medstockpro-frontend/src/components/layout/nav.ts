import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  History,
  LayoutDashboard,
  PackagePlus,
  ScanBarcode,
  Settings,
  Tags,
  Truck,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RouteKey } from "../../stores/uiStore";

export type NavItem = {
  key: RouteKey;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  description?: string;
  shortcut?: string;
};

export const navItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Clinic overview & today's activity",
    shortcut: "g d",
  },
  {
    key: "products",
    label: "Products",
    icon: Boxes,
    description: "Browse, edit and add inventory",
    shortcut: "g p",
  },
  {
    key: "scan",
    label: "Scan",
    icon: ScanBarcode,
    description: "Scan a barcode to find a product",
    shortcut: "g s",
  },
  {
    key: "receive",
    label: "Receive",
    icon: PackagePlus,
    description: "Record an incoming shipment",
    shortcut: "g r",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: Truck,
    description: "Manage supplier directory",
  },
  {
    key: "categories",
    label: "Categories",
    icon: Tags,
    description: "Organize product taxonomy",
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    description: "Monthly insights & restock estimate",
    adminOnly: true,
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: AlertTriangle,
    description: "Low stock and expiry alerts",
  },
  {
    key: "approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    description: "Review pending stock returns",
    adminOnly: true,
  },
  {
    key: "users",
    label: "Users",
    icon: UserCog,
    description: "Manage staff and roles",
    adminOnly: true,
  },
  {
    key: "audit",
    label: "Activity log",
    icon: History,
    description: "Every important action recorded by the system",
    adminOnly: true,
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    description: "Preferences, backup, theme",
  },
];
