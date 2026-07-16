import React from "react";
import { orders } from "../../../react-rsc-commerce/src/data/catalog.js";
import { formatCurrency } from "../../../react-rsc-commerce/src/lib/pricing.js";

export default function Orders() {
  return (
    <section className="grid gap-4.5">
      <div className="mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Orders</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          Recent deliveries
        </h1>
      </div>
      {orders.map((order) => (
        <article
          key={order.id}
          className="grid gap-3.5 border-2 border-ink bg-porcelain p-5"
        >
          <div className="flex justify-between">
            <strong>{order.id}</strong>
            <span>{order.date}</span>
          </div>
          <p>{order.items.join(" · ")}</p>
          <footer className="flex justify-between border-t border-ink pt-2.5">
            <span>{order.status}</span>
            <strong>{formatCurrency(order.total)}</strong>
          </footer>
        </article>
      ))}
    </section>
  );
}
