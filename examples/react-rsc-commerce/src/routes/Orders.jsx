import React from "react";
import { orders } from "../data/catalog.js";
import { formatCurrency } from "../lib/pricing.js";

export default function Orders() {
  return (
    <section className="route-stack">
      <div className="route-heading">
        <p className="eyebrow">Orders</p>
        <h1>Recent deliveries</h1>
      </div>
      <div className="order-list">
        {orders.map((order) => (
          <article key={order.id}>
            <div>
              <strong>{order.id}</strong>
              <span>{order.date}</span>
            </div>
            <p>{order.items.join(" · ")}</p>
            <footer>
              <span>{order.status}</span>
              <strong>{formatCurrency(order.total)}</strong>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
