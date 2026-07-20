"use client";

import React from "react";
import { useCart } from "./CartContext.jsx";

export function CommerceChrome({ children, path }) {
  const cart = useCart();

  return (
    <>
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
    </>
  );
}
