import React from "react";
import "./lib/commerceTelemetry.dev.js" with {
  condition: "__DEV__",
  else: "./lib/commerceTelemetry.prod.js",
};
import { resolveRoute, navItems } from "./router.js";

export default async function App({ path, searchParams }) {
  const { id, label, Component } = await resolveRoute(path);
  return (
    <main className="app-shell" data-route={id}>
      <header className="store-header">
        <a className="brand" href="/">
          <span className="brand-mark">M</span>
          <span>
            <strong>What!!</strong>
            <small>provisions for precise homes</small>
          </span>
        </a>
        <nav className="nav-strip" aria-label="Store">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              aria-current={item.label === label ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <Component path={path} searchParams={searchParams} />
    </main>
  );
}
