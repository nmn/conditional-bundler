"use client";

import React from "react";
import * as stylex from "@stylexjs/stylex";
import { useCart } from "./CartContext.jsx";

export function CartTable() {
  const cart = useCart();

  if (cart.items.length === 0) {
    return (
      <section {...stylex.props(styles.empty)}>
        <h2>Your cart is a clean slate.</h2>
        <p>Start with coffee, stoneware, or a pantry refill.</p>
        <a href="/catalog" {...stylex.props(styles.navLink)}>
          Browse catalog
        </a>
      </section>
    );
  }

  return (
    <section {...stylex.props(styles.cartList)}>
      {cart.items.map((item) => (
        <article key={item.id} {...stylex.props(styles.cartRow)}>
          <span {...stylex.props(styles.miniSwatch, productColors[item.id])} />
          <div>
            <h3>{item.name}</h3>
            <p>
              Qty {item.quantity} · ${item.price * item.quantity}
            </p>
          </div>
          <button
            type="button"
            {...stylex.props(styles.button)}
            onClick={() => cart.remove(item.id)}
          >
            Remove
          </button>
        </article>
      ))}
      <footer {...stylex.props(styles.cartFooter)}>
        <span>Subtotal</span>
        <strong>${cart.subtotal}</strong>
      </footer>
    </section>
  );
}

const styles = stylex.create({
  empty: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    padding: 24,
  },
  navLink: {
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "inherit",
    display: "inline-block",
    paddingBlock: 9,
    paddingInline: 12,
    textDecoration: "none",
  },
  cartList: {
    display: "grid",
    gap: 10,
  },
  cartRow: {
    alignItems: "center",
    borderBottomColor: "#2f2a22",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    display: "grid",
    gap: 14,
    gridTemplateColumns: "40px 1fr auto",
    paddingBlock: 14,
  },
  miniSwatch: {
    height: 36,
    width: 36,
  },
  button: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#1b1915",
    cursor: "pointer",
    fontFamily: "inherit",
    paddingBlock: 9,
    paddingInline: 11,
  },
  cartFooter: {
    display: "flex",
    justifyContent: "space-between",
    paddingBlock: 14,
  },
});

const productColors = stylex.create({
  "copper-kettle": { backgroundColor: "#b87333" },
  "stoneware-set": { backgroundColor: "#61746a" },
  "market-tote": { backgroundColor: "#d7b56d" },
  "espresso-sampler": { backgroundColor: "#5a3a2e" },
  "preserved-citrus": { backgroundColor: "#e0a72e" },
  "linen-runner": { backgroundColor: "#a8b1a0" },
  "breakfast-club": { backgroundColor: "#db6b42" },
  "maple-granola": { backgroundColor: "#b8803d" },
});
