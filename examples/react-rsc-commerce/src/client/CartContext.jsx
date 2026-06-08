"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = (globalThis.__MONARCH_CART_CONTEXT__ ??=
  createContext(null));

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const api = useMemo(
    () => ({
      items,
      count: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce(
        (total, item) => total + item.quantity * item.price,
        0,
      ),
      add(product) {
        setItems((current) => {
          const existing = current.find((item) => item.id === product.id);
          if (existing) {
            return current.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            );
          }
          return [...current, { ...product, quantity: 1 }];
        });
      },
      remove(id) {
        setItems((current) => current.filter((item) => item.id !== id));
      },
    }),
    [items],
  );
  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return cart;
}
