"use client";

import React from "react";
import * as stylex from "@stylexjs/stylex";
import { useCart } from "./CartContext.jsx";

export function CommerceChrome({ children, path }) {
  const cart = useCart();

  return (
    <>
      <aside {...stylex.props(styles.clientRail)} aria-label="Cart status">
        <a href="/cart" {...stylex.props(styles.cartChip)}>
          <span {...stylex.props(styles.count)}>{cart.count}</span>
          <strong>Cart</strong>
        </a>
        <a href="/search" {...stylex.props(styles.navLink)}>
          Search
        </a>
        <span {...stylex.props(styles.smallCaps)}>{path || "/"}</span>
      </aside>
      {children}
    </>
  );
}

const styles = stylex.create({
  clientRail: {
    alignItems: "center",
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginInline: "auto",
    maxWidth: 1380,
    paddingBlockStart: 12,
    paddingInline: 32,
    "@media (max-width: 640px)": {
      justifyContent: "flex-start",
      paddingInline: 16,
    },
  },
  cartChip: {
    alignItems: "center",
    backgroundColor: "#1b1915",
    color: "#f5eee1",
    display: "flex",
    gap: 8,
    paddingBlock: 10,
    paddingInline: 14,
    textDecoration: "none",
  },
  count: {
    backgroundColor: "#d7ff45",
    color: "#1b1915",
    minWidth: 25,
    paddingInline: 6,
    textAlign: "center",
  },
  navLink: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#1b1915",
    paddingBlock: 9,
    paddingInline: 12,
    textDecoration: "none",
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
