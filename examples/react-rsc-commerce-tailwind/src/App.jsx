import React from "react";
import monarchMark from "./assets/monarch-mark.svg";
import { BrowserConditionProof } from "./BrowserString.jsx";
import { CartProvider } from "./client/CartContext.jsx";
import { CommerceChrome } from "./client/CommerceChrome.jsx";
import { Router } from "./client/Router.jsx";
import { classes } from "./classes.js";
import { navItems, resolveRoute } from "./routes.js";

export default async function App({ path, searchParams }) {
  const { id, label, Component } = await resolveRoute(path);
  return (
    <div className="min-h-dvh bg-paper font-serif text-ink">
      <CartProvider>
        <Router>
          <CommerceChrome path={path}>
            <main
              className="mx-auto min-h-dvh max-w-[1380px] px-4 py-7 sm:px-8"
              data-route={id}
            >
              <header className="mb-8 grid grid-cols-1 items-start gap-4.5 border-b-2 border-ink pb-4.5 lg:grid-cols-[minmax(250px,1fr)_auto_auto] lg:items-center">
                <a
                  href="/"
                  className="flex items-center gap-3.5 text-ink no-underline"
                >
                  <span className="flex h-12.5 w-12.5 items-center justify-center bg-ink text-2xl text-acid">
                    M
                  </span>
                  <span className="grid gap-0.5">
                    <strong className="text-xl">Monarch Goods</strong>
                    <small className="font-sans text-xs tracking-wider uppercase">
                      provisions for precise homes / Tailwind
                    </small>
                  </span>
                </a>
                <img
                  className="h-16 w-16"
                  src={monarchMark.src}
                  width={monarchMark.width}
                  height={monarchMark.height}
                  alt=""
                />
                <nav
                  className="flex flex-wrap justify-start gap-1.5 lg:justify-end"
                  aria-label="Store"
                >
                  {navItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      aria-current={item.label === label ? "page" : undefined}
                      className={classes(
                        "min-h-10 border border-ink px-3 py-2 text-ink no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-oxide",
                        item.label === label && "bg-acid",
                      )}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </header>
              <BrowserConditionProof />
              <Component path={path} searchParams={searchParams} />
            </main>
          </CommerceChrome>
        </Router>
      </CartProvider>
    </div>
  );
}
