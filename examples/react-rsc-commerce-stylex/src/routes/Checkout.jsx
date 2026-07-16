import React from "react";
import * as stylex from "@stylexjs/stylex";

export default function Checkout() {
  return (
    <section {...stylex.props(styles.checkoutGrid)}>
      <div {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Checkout</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          Three quiet steps from market to doorstep.
        </h1>
      </div>
      {["Contact", "Delivery", "Payment"].map((step, index) => (
        <article key={step} {...stylex.props(styles.panel, styles.processCard)}>
          <span {...stylex.props(styles.processNumber)}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2>{step}</h2>
          <p>
            {index === 0
              ? "Use your account details or continue as a guest."
              : index === 1
                ? "Choose courier delivery, pickup, or a monthly subscription window."
                : "Review taxes, credits, gift notes, and final authorization."}
          </p>
        </article>
      ))}
    </section>
  );
}

const styles = stylex.create({
  checkoutGrid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  heading: {
    gridColumn: "1 / -1",
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
  panel: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "grid",
    gap: 14,
    padding: 20,
  },
  processCard: {
    minHeight: 240,
  },
  processNumber: {
    fontSize: 46,
  },
});
