"use client";

import React, { useState } from "react";
import { useCart } from "./CartContext.jsx";

export function ProductActions({ product }) {
  const cart = useCart();
  const [selected, setSelected] = useState("standard");

  return (
    <div className="purchase-panel">
      <div className="segmented" aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option) => (
          <button
            key={option}
            type="button"
            className={selected === option ? "active" : ""}
            onClick={() => setSelected(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        className="primary-action"
        type="button"
        onClick={() => cart.add(product)}
      >
        Add to cart
      </button>
      <p>{cart.count} items reserved in this browser session.</p>
    </div>
  );
}
