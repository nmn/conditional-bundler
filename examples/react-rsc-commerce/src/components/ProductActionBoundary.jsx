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
    <div className="purchase-panel purchase-panel-pending">
      <div className="segmented" aria-label="Fulfillment speed">
        {["standard", "priority", "gift"].map((option, index) => (
          <button
            key={option}
            type="button"
            className={index === 0 ? "active" : ""}
            disabled
          >
            {option}
          </button>
        ))}
      </div>
      <button className="primary-action" type="button" disabled>
        Add to cart
      </button>
      <p>Cart controls loading.</p>
    </div>
  );
}
