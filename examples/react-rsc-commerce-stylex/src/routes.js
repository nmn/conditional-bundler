const routes = [
  {
    id: "home",
    label: "Home",
    match: (path) => path === "/",
    load: () => import("./routes/Home.jsx"),
  },
  {
    id: "catalog",
    label: "Catalog",
    match: (path) => path === "/catalog",
    load: () => import("./routes/Catalog.jsx"),
  },
  {
    id: "product",
    label: "Product",
    match: (path) => path.startsWith("/product/"),
    load: () => import("./routes/Product.jsx"),
  },
  {
    id: "cart",
    label: "Cart",
    match: (path) => path === "/cart",
    load: () => import("./routes/Cart.jsx"),
  },
  {
    id: "checkout",
    label: "Checkout",
    match: (path) => path === "/checkout",
    load: () => import("./routes/Checkout.jsx"),
  },
  {
    id: "orders",
    label: "Orders",
    match: (path) => path === "/orders",
    load: () => import("./routes/Orders.jsx"),
  },
  {
    id: "account",
    label: "Account",
    match: (path) => path === "/account",
    load: () => import("./routes/Account.jsx"),
  },
  {
    id: "journal",
    label: "Journal",
    match: (path) => path === "/journal",
    load: () => import("./routes/Journal.jsx"),
  },
  {
    id: "search",
    label: "Search",
    match: (path) => path === "/search",
    load: () => import("./routes/Search.jsx"),
  },
  {
    id: "support",
    label: "Support",
    match: (path) => path === "/support",
    load: () => import("./routes/Support.jsx"),
  },
];

export const navItems = routes
  .filter((route) => !["product", "search"].includes(route.id))
  .map(({ id, label }) => ({
    id,
    label,
    href: id === "home" ? "/" : `/${id}`,
  }));

export async function resolveRoute(path) {
  const pathname = new URL(path, "http://monarch.local").pathname;
  const route =
    routes.find((candidate) => candidate.match(pathname)) ?? routes[0];
  const loaded = await route.load();
  return {
    id: route.id,
    label: route.label,
    Component: loaded.default,
  };
}
