import React from "react";
import * as stylex from "@stylexjs/stylex";
import { orders } from "../../../react-rsc-commerce/src/data/catalog.js";
import { formatCurrency } from "../../../react-rsc-commerce/src/lib/pricing.js";

export default function Orders() {
  return (
    <section {...stylex.props(styles.routeStack)}>
      <div {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Orders</p>
        <h1 {...stylex.props(styles.routeTitle)}>Recent deliveries</h1>
      </div>
      <div {...stylex.props(styles.orderList)}>
        {orders.map((order) => (
          <article key={order.id} {...stylex.props(styles.panel)}>
            <div {...stylex.props(styles.orderMeta)}>
              <strong>{order.id}</strong>
              <span>{order.date}</span>
            </div>
            <p>{order.items.join(" · ")}</p>
            <footer {...stylex.props(styles.orderFooter)}>
              <span>{order.status}</span>
              <strong>{formatCurrency(order.total)}</strong>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles = stylex.create({
  routeStack: {
    display: "grid",
    gap: 18,
  },
  heading: {
    marginBottom: 24,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  routeTitle: {
    fontSize: "clamp(3rem, 7vw, 7rem)",
    letterSpacing: -4,
    lineHeight: 0.9,
    marginBlock: 6,
  },
  orderList: {
    display: "grid",
    gap: 12,
  },
  panel: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "grid",
    gap: 14,
    padding: 20,
  },
  orderMeta: {
    display: "flex",
    justifyContent: "space-between",
  },
  orderFooter: {
    borderTopColor: "#2f2a22",
    borderTopStyle: "solid",
    borderTopWidth: 1,
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 10,
  },
});
