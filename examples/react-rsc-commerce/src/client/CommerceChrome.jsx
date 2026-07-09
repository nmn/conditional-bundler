"use client";

import React from "react";
import { useCart } from "./CartContext.jsx";

export function CommerceChrome({ children, path }) {
  const cart = useCart();

  function handleClick(event) {
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.origin !== window.location.origin) {
      return;
    }
    event.preventDefault();
    window.dispatchEvent(
      new CustomEvent("bundler:rsc-navigate", {
        cancelable: true,
        detail: { path: anchor.pathname + anchor.search },
      }),
    );
  }

  return (
    <div onClick={handleClick}>
      <aside className="client-rail" aria-label="Cart status">
        <a href="/cart" className="cart-chip">
          <span>{cart.count}</span>
          <strong>Cart</strong>
        </a>
        <a className="search-chip" href="/search">
          Search
        </a>
        <span className="path-chip">{path || "/"}</span>
      </aside>
      {children}
    </div>
  );
}
