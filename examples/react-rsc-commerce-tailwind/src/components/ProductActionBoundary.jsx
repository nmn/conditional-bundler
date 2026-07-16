import React, { Suspense } from "react";
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
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option, index) => (
          <button
            key={option}
            type="button"
            className={`border border-ink px-2.5 py-2 ${
              index === 0 ? "bg-acid" : "bg-porcelain"
            }`}
            disabled
          >
            {option}
          </button>
        ))}
      </div>
      <button
        className="border border-ink bg-ink px-4 py-3 text-paper"
        type="button"
        disabled
      >
        Add to cart
      </button>
      <p>Cart controls loading.</p>
    </div>
  );
}
