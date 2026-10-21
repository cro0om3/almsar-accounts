export const PERMISSIONS = [
  "home",
  "fleet",
  "finances",
  "quotes",
  "invoices",
  "receipts",
  "orders",
  "expenses",
  "customers",
  "vehicles",
  "vendors",
  "employees",
  "payslips",
  "reports",
  "files",
  "settings",
];

export const ACCOUNTANT_PERMISSIONS = [
  "home",
  "quotes",
  "invoices",
  "receipts",
  "orders",
  "expenses",
  "customers",
  "reports",
];

const PATHS = [
  ["/vehicle-dashboard", "fleet"],
  ["/vehicle-finances", "finances"],
  ["/quotes", "quotes"],
  ["/invoices", "invoices"],
  ["/receipts", "receipts"],
  ["/purchase-orders", "orders"],
  ["/expenses", "expenses"],
  ["/customers", "customers"],
  ["/vehicles", "vehicles"],
  ["/vendors", "vendors"],
  ["/employees", "employees"],
  ["/payslips", "payslips"],
  ["/reports", "reports"],
  ["/files", "files"],
  ["/settings", "settings"],
  ["/api/company-files", "files"],
  ["/api/employee-files", "employees"],
];

export function can(session, key) {
  if (!session) return false;
  if (session.role === "admin") return true;
  const list = Array.isArray(session.permissions) ? session.permissions : [];
  return list.includes("*") || list.includes(key);
}

export function permissionForPath(pathname) {
  if (pathname === "/") return "home";
  const hit = PATHS.find(([href]) => pathname === href || pathname.startsWith(`${href}/`));
  return hit ? hit[1] : null;
}

export function firstAllowed(session) {
  if (can(session, "home")) return "/";
  const hit = PATHS.find(([, key]) => can(session, key));
  return hit ? hit[0] : "/login";
}
