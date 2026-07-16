"use client";

import React, { useState } from "react";
import { classes } from "../classes.js";
import { useCart } from "./CartContext.jsx";

export function ProductActions({ product }) {
  const cart = useCart();
  const [selected, setSelected] = useState("standard");

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option) => (
          <button
            key={option}
            type="button"
            className={classes(
              "cursor-pointer border border-ink px-2.5 py-2",
              selected === option ? "bg-acid" : "bg-porcelain",
            )}
            onClick={() => setSelected(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        className="cursor-pointer border border-ink bg-ink px-4 py-3 text-paper"
        type="button"
        onClick={() => cart.add(product)}
      >
        Add to cart
      </button>
      <p>{cart.count} items reserved in this browser session.</p>
    </div>
  );
}
