"use client";

import React from "react";
import { useCart } from "./CartContext.jsx";

export function CommerceChrome({ children, onNavigate, path }) {
  const cart = useCart();

  function handleClick(event) {
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.origin !== window.location.origin) {
      return;
    }
    event.preventDefault();
    onNavigate(anchor.pathname + anchor.search);
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
