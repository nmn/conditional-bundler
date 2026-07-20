import React from "react";
import { BrowserConditionProof } from "./BrowserString.jsx";
import { classes } from "./classes.js";
import { navItems } from "./router.js";

export function App({ routeId, Route }) {
  return (
    <div className="min-h-screen bg-night font-sans text-copy">
      <div className="mx-auto grid max-w-7xl grid-cols-[240px_minmax(0,1fr)] gap-6 p-7">
        <aside className="grid min-h-[calc(100vh-56px)] content-start gap-4 border border-line bg-panel p-4.5">
          <strong className="text-2xl tracking-tight text-pop">
            Signal House
          </strong>
          <span className="font-mono text-xs tracking-wider text-muted uppercase">
            Tailwind universal SPA
          </span>
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={classes(
                  "border border-line px-3 py-2.5 text-copy no-underline",
                  item.id === routeId && "bg-pop text-night",
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="grid content-start gap-5">
          <BrowserConditionProof />
          <Route />
        </main>
      </div>
    </div>
  );
}
