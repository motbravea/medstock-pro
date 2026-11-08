/**
 * Central type system. Mirrors the backend's anonymous response shapes
 * verbatim — field names are camelCased per ASP.NET's default JSON serializer.
 */

export type Role = "Admin" | "Staff";

export type LoggedInUser = {
  id: number;
  fullName: string;
  username: string;
  role: Role;
  isActive: boolean;
};

export type LoginResponse = {
  message: string;
  token: string;
  user: LoggedInUser;
};

export type UserSummary = {
  id: number;
  fullName: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  photoPath: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string | null;
  expiryAlertDays: number;
  internalBarcode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // ── Enrichment from GET /Products and GET /Products/search ──────────────
  // Optional for backwards-compat with single-product endpoints that don't
  // include them.
  categories?: { id: number; name: string }[];
  supplierCount?: number;
  supplierBarcodes?: string[];
  hasInternalBarcode?: boolean;
  isSetupReady?: boolean;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

/**
 * Response of GET /api/Categories/{id}/products — the category-side mirror
 * of /Products/{id}/categories. Includes pre-aggregated counts so the
 * drawer can render stat tiles without a second round-trip.
 */
export type CategoryDetails = {
  id: number;
  name: string;
  description: string;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
  expiredCount: number;
  products: CategoryProduct[];
};

export type CategoryProduct = {
  id: number;
  name: string;
  description: string;
  photoPath: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string | null;
  expiryAlertDays: number;
  internalBarcode: string;
};

export type Supplier = {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
};

export type ProductSupplier = {
  id: number;
  supplierId: number;
  supplierName: string;
  phoneNumber: string;
  email: string;
  supplierBarcode: string;
  price: number;
  lastPurchaseDate: string | null;
  isPreferredSupplier: boolean;
};

/**
 * One row of `GET /api/Suppliers/{id}/products` — the supplier-side mirror
 * of ProductSupplier. Same physical row, different keys (Product fields
 * up front, link metadata after).
 */
export type SupplierProduct = {
  productSupplierId: number;
  productId: number;
  productName: string;
  description: string;
  photoPath: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string | null;
  internalBarcode: string;
  supplierBarcode: string;
  price: number;
  lastPurchaseDate: string | null;
  isPreferredSupplier: boolean;
};

export type ProductBarcode = {
  id: number;
  productId: number;
  barcodeValue: string;
  barcodeType: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
};

export type MovementType =
  | "StockIn"
  | "StockOut"
  | "Adjustment"
  | "Damaged"
  | "Expired";

export type StockMovement = {
  id: number;
  productId: number;
  productName?: string;
  userId: number;
  userName: string;
  movementType: MovementType;
  quantity: number;
  oldStock: number;
  newStock: number;
  notes: string;
  createdAt: string;
};

export type Severity = "Critical" | "Warning" | "Info";

export type Alert = {
  id: number;
  productId: number;
  productName: string;
  alertType: "LowStock" | "ExpiringSoon" | "Expired" | string;
  message: string;
  severity: Severity;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string | null;
};

export type DashboardSummary = {
  totalProducts: number;
  lowStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  activeAlertsCount: number;
  unreadAlertsCount: number;
  usedTodayCount: number;
  usedThisMonthCount: number;
};

export type UrgentAlert = {
  id: number;
  productId: number;
  productName: string;
  alertType: string;
  message: string;
  severity: Severity;
  isRead: boolean;
  createdAt: string;
};

export type TopUsedProduct = {
  productId: number;
  productName: string;
  totalUsed: number;
};

export type CategoryConsumption = {
  categoryName: string;
  totalUsed: number;
};

export type MonthlySummary = {
  year: number;
  month: number;
  period: string;
  activeProducts: number;
  totalMovements: number;
  stockOutQuantity: number;
  stockInQuantity: number;
  damagedQuantity: number;
  expiredQuantity: number;
  alertsCreated: number;
  lowStockProducts: number;
};

export type ProductUsage = {
  productId: number;
  productName: string;
  totalUsed: number;
  usageCount: number;
};

export type CategoryUsage = {
  categoryId: number;
  categoryName: string;
  totalUsed: number;
};

export type StaffUsage = {
  userId: number;
  userName: string;
  totalUsed: number;
  actionsCount: number;
};

export type SupplierCostOverviewItem = {
  productId: number;
  productName: string;
  cheapestSupplier: {
    supplierId: number;
    supplierName: string;
    phoneNumber: string;
    email: string;
    price: number;
    supplierBarcode: string;
  } | null;
  preferredSupplier: {
    supplierId: number;
    supplierName: string;
    phoneNumber: string;
    email: string;
    price: number;
    supplierBarcode: string;
  } | null;
  suppliers: Array<{
    supplierId: number;
    supplierName: string;
    phoneNumber: string;
    email: string;
    price: number;
    supplierBarcode: string;
    isPreferredSupplier: boolean;
    lastPurchaseDate: string | null;
  }>;
};

export type RestockEstimateItem = {
  productId: number;
  productName: string;
  currentStock: number;
  minimumStock: number;
  suggestedRestockQuantity: number;
  supplier: {
    supplierId: number;
    supplierName: string;
    phoneNumber: string;
    email: string;
    price: number;
    supplierBarcode: string;
    isPreferredSupplier: boolean;
  } | null;
  estimatedCost: number;
};

export type RestockEstimate = {
  totalLowStockProducts: number;
  totalEstimatedCost: number;
  items: RestockEstimateItem[];
};

export type BackupInfo = {
  databasePath: string;
  fileSizeKb: number;
  lastModified: string;
  exists: boolean;
};

export type ScanResult = Product & {
  scannedBarcode: string;
  barcodeType: string;
};

export type SetupStatus = {
  productId: number;
  productName: string;
  hasPhoto: boolean;
  hasInternalBarcode: boolean;
  hasSupplierBarcode: boolean;
  hasCategory: boolean;
  hasSupplier: boolean;
  hasMinimumStock: boolean;
  hasExpirySettings: boolean;
  isReady: boolean;
  missingItems: {
    photo: boolean;
    internalBarcode: boolean;
    category: boolean;
    supplier: boolean;
    minimumStock: boolean;
    expirySettings: boolean;
  };
};

export type ProductFullDetails = {
  product: Product & {
    photoUrl: string;
    stockStatus: "Healthy" | "Low stock" | string;
    expiryStatus: "Valid" | "Expiring soon" | "Expired" | "No expiry date";
  };
  categories: { id: number; name: string; description: string }[];
  suppliers: ProductSupplier[];
  barcodes: ProductBarcode[];
  activeAlerts: Pick<Alert, "id" | "alertType" | "message" | "severity" | "isRead" | "createdAt">[];
  setupStatus: Omit<SetupStatus, "productId" | "productName">;
};

export type BarcodeLabel = {
  productId: number;
  productName: string;
  description: string;
  barcodeValue: string;
  barcodeType: string;
  labelTitle: string;
  labelSubtitle: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string | null;
  photoPath: string;
  generatedAt: string;
};

export type AuditLog = {
  id: number;
  userId: number | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: number;
  entityName: string;
  description: string;
  oldValues: string;
  newValues: string;
  ipAddress: string;
  createdAt: string;
};

export type AuditLogPage = {
  total: number;
  page: number;
  pageSize: number;
  items: AuditLog[];
};

/* ── DTOs (request bodies) ────────────────────────────────────────────── */

export type LoginRequest = {
  username: string;
  password: string;
};

export type CreateUserRequest = {
  fullName: string;
  username: string;
  password: string;
  role: Role;
};

/** Profile update — password is NEVER part of this payload. */
export type UpdateUserRequest = {
  fullName: string;
  username: string;
  role: Role;
};

export type ChangePasswordRequest = {
  password: string;
};

export type CreateProductRequest = {
  name: string;
  description: string;
  photoPath: string;
  currentStock: number;
  minimumStock: number;
  expiryDate: string | null;
  expiryAlertDays: number;
  internalBarcode: string;
};

export type UpdateProductRequest = CreateProductRequest & {
  isActive: boolean;
};

export type CategoryRequest = {
  name: string;
  description: string;
};

export type SupplierRequest = {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  notes: string;
};

export type ProductSupplierRequest = {
  supplierId: number;
  supplierBarcode: string;
  price: number;
  lastPurchaseDate: string | null;
  isPreferredSupplier: boolean;
};

export type ProductBarcodeRequest = {
  barcodeValue: string;
  barcodeType: string;
  notes: string;
};

export type StockMovementRequest = {
  productId: number;
  quantity: number;
  movementType: MovementType;
  notes: string;
};

/* ── Pending movements (approval queue) ───────────────────────────────── */

export type PendingStatus = "Pending" | "Approved" | "Rejected";

export type PendingMovement = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  status: PendingStatus;
  movementType: string;
  requesterNotes: string;
  reviewerNotes: string;
  createdAt: string;
  reviewedAt: string | null;
  requestedBy: string;
  requestedByUsername: string;
  reviewedBy: string | null;
  sourceMovementId: number;
  sourceCreatedAt: string | null;
  restoredMovementId: number | null;
};

export type PendingMovementCount = {
  pending: number;
};

export type ScanActionRequest = {
  productId: number;
  quantity: number;
  notes: string;
};

export type ReceiveStockRequest = {
  productId: number;
  quantity: number;
  /** Optional. Must reference an existing ProductSupplier link. */
  supplierId: number | null;
  /** Optional. ISO date string (yyyy-MM-dd) to refresh the product's expiry. */
  expiryDate: string | null;
  notes: string;
};

export type ReceiveStockResponse = {
  message: string;
  movement: {
    id: number;
    product: string;
    movementType: "StockIn";
    quantity: number;
    oldStock: number;
    newStock: number;
    expiryDate: string | null;
    supplierUsed: string | null;
    notes: string;
    createdAt: string;
  };
};

export type PendingMovementReviewRequest = {
  notes: string;
};

/* ── Licensing ────────────────────────────────────────────────────────── */

export type LicenseState =
  | "Unlicensed"
  | "Active"
  | "MachineMismatch"
  | "Inactive"
  | "Expired";

export type LicenseStatus = {
  licensed: boolean;
  state: LicenseState;
  clinicName: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  maxDevices: number | null;
  message: string;
};

export type ActivateLicenseRequest = {
  clinicName: string;
  licenseKey: string;
};
