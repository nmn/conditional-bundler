import React from "react";
import monarchMark from "./assets/monarch-mark.svg";
import { CartProvider } from "./client/CartContext.jsx";
import { CommerceChrome } from "./client/CommerceChrome.jsx";
import { classes } from "./classes.js";
import { navItems, resolveRoute } from "./router.js";

export default async function App({ path, searchParams }) {
  const { id, label, Component } = await resolveRoute(path);
  return (
    <div className="min-h-screen bg-paper font-serif text-ink">
      <CartProvider>
        <CommerceChrome path={path}>
          <main
            className="mx-auto min-h-screen max-w-[1380px] px-8 py-7"
            data-route={id}
          >
            <header className="mb-8 grid grid-cols-[minmax(250px,1fr)_auto] items-center gap-4.5 border-b-2 border-ink pb-4.5">
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
                className="flex flex-wrap justify-end gap-1.5"
                aria-label="Store"
              >
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    aria-current={item.label === label ? "page" : undefined}
                    className={classes(
                      "border border-ink px-3 py-2 text-ink no-underline",
                      item.label === label && "bg-acid",
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </header>
            <Component path={path} searchParams={searchParams} />
          </main>
        </CommerceChrome>
      </CartProvider>
    </div>
  );
}
