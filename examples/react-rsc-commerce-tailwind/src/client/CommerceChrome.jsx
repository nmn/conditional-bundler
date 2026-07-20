"use client";

import React from "react";
import { useCart } from "./CartContext.jsx";

export function CommerceChrome({ children, path }) {
  const cart = useCart();

  return (
    <>
      <aside
        className="mx-auto flex max-w-[1380px] items-center justify-start gap-2 px-4 pt-3 sm:justify-end sm:px-8"
        aria-label="Cart status"
      >
        <a
          href="/cart"
          className="flex items-center gap-2 bg-ink px-4 py-2.5 text-paper no-underline"
        >
          <span className="min-w-6 bg-acid px-1.5 text-center text-ink">
            {cart.count}
          </span>
          <strong>Cart</strong>
        </a>
        <a
          href="/search"
          className="border border-ink bg-porcelain px-3 py-2 text-ink no-underline"
        >
          Search
        </a>
        <span className="font-sans text-xs tracking-wider uppercase">
          {path || "/"}
        </span>
      </aside>
      {children}
    </>
  );
}
