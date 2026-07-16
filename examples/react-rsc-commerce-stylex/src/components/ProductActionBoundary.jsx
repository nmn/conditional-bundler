import React, { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { ProductActions } from "../client/ProductActions.jsx";

export function ProductActionBoundary({ product }) {
  return (
    <Suspense fallback={<ProductActionFallback />}>
      <ProductActions product={product} />
    </Suspense>
  );
}

function ProductActionFallback() {
  return (
    <div {...stylex.props(styles.purchase)}>
      <div {...stylex.props(styles.buttonRow)} aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option, index) => (
          <button
            key={option}
            type="button"
            disabled
            {...stylex.props(styles.button, index === 0 && styles.buttonActive)}
          >
            {option}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled
        {...stylex.props(styles.button, styles.primaryButton)}
      >
        Add to cart
      </button>
      <p>Cart controls loading.</p>
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
