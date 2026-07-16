"use client";

import React from "react";
import { classes, productColorClass } from "../classes.js";
import { useCart } from "./CartContext.jsx";

export function CartTable() {
  const cart = useCart();

  if (cart.items.length === 0) {
    return (
      <section className="border-2 border-ink bg-porcelain p-6">
        <h2 className="text-3xl">Your cart is a clean slate.</h2>
        <p>Start with coffee, stoneware, or a pantry refill.</p>
        <a
          href="/catalog"
          className="inline-block border border-ink px-3 py-2 text-ink no-underline"
        >
          Browse catalog
        </a>
      </section>
    );
  }

  return (
    <section className="grid gap-2.5">
      {cart.items.map((item) => (
        <article
          key={item.id}
          className="grid grid-cols-[40px_1fr_auto] items-center gap-3.5 border-b border-ink py-3.5"
        >
          <span className={classes("h-9 w-9", productColorClass(item.id))} />
          <div>
            <h3>{item.name}</h3>
            <p>
              Qty {item.quantity} · ${item.price * item.quantity}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer border border-ink bg-porcelain px-3 py-2"
            onClick={() => cart.remove(item.id)}
          >
            Remove
          </button>
        </article>
      ))}
      <footer className="flex justify-between py-3.5">
        <span>Subtotal</span>
        <strong>${cart.subtotal}</strong>
      </footer>
    </section>
  );
}
