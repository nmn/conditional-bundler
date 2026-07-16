const routes = {
  dashboard: () => import("./routes/Dashboard.jsx"),
  inventory: () => import("./routes/Inventory.jsx"),
  reports: () => import("./routes/Reports.jsx"),
  settings: () => import("./routes/Settings.jsx"),
};

export const navItems = [
  ["dashboard", "Dashboard", "/"],
  ["inventory", "Inventory", "/inventory"],
  ["reports", "Reports", "/reports"],
  ["settings", "Settings", "/settings"],
].map(([id, label, href]) => ({ id, label, href }));

export async function loadRoute(pathname) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const id = routes[segment] ? segment : "dashboard";
  const loaded = await routes[id]();
  return { id, Route: loaded.default };
}
