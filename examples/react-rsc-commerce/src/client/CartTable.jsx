"use client";

import React from "react";
import { useCart } from "./CartContext.jsx";

export function CartTable() {
  const cart = useCart();

  if (cart.items.length === 0) {
    return (
      <section className="empty-cart">
        <h2>Your cart is a clean slate.</h2>
        <p>Start with coffee, stoneware, or a pantry refill.</p>
        <a href="/catalog">Browse catalog</a>
      </section>
    );
  }

  return (
    <section className="cart-table">
      {cart.items.map((item) => (
        <article key={item.id}>
          <span className="product-swatch" style={{ background: item.color }} />
          <div>
            <h3>{item.name}</h3>
            <p>
              Qty {item.quantity} · ${item.price * item.quantity}
            </p>
          </div>
          <button type="button" onClick={() => cart.remove(item.id)}>
            Remove
          </button>
        </article>
      ))}
      <footer>
        <span>Subtotal</span>
        <strong>${cart.subtotal}</strong>
      </footer>
    </section>
  );
}
