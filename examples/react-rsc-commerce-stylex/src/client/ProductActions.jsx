"use client";

import React, { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { useCart } from "./CartContext.jsx";

export function ProductActions({ product }) {
  const cart = useCart();
  const [selected, setSelected] = useState("standard");

  return (
    <div {...stylex.props(styles.purchase)}>
      <div {...stylex.props(styles.buttonRow)} aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option) => (
          <button
            key={option}
            type="button"
            {...stylex.props(
              styles.button,
              selected === option && styles.buttonActive,
            )}
            onClick={() => setSelected(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        type="button"
        {...stylex.props(styles.button, styles.primaryButton)}
        onClick={() => cart.add(product)}
      >
        Add to cart
      </button>
      <p>{cart.count} items reserved in this browser session.</p>
    </div>
  );
}

const styles = stylex.create({
  purchase: {
    display: "grid",
    gap: 8,
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
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
  buttonActive: {
    backgroundColor: "#d7ff45",
  },
  primaryButton: {
    backgroundColor: "#1b1915",
    color: "#f5eee1",
    width: "100%",
  },
});
