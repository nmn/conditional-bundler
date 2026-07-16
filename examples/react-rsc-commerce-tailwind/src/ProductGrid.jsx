import React from "react";
import { ProductActionBoundary } from "./components/ProductActionBoundary.jsx";
import { formatCurrency } from "../../react-rsc-commerce/src/lib/pricing.js";
import { classes, productColorClass } from "./classes.js";

export function ProductGrid({ products }) {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(235px,1fr))] gap-4.5">
      {products.map((product) => (
        <article
          key={product.id}
          className="grid gap-4 border-2 border-ink bg-porcelain p-3.5"
        >
          <a
            href={`/product/${product.id}`}
            className="relative flex aspect-[1.18] items-center justify-center border border-ink text-ink no-underline"
          >
            <span
              className={classes(
                "h-[58%] w-[58%] rounded-full",
                productColorClass(product.id),
              )}
            />
            <em className="absolute bottom-2.5 left-2.5 bg-acid px-2.5 py-1.5 not-italic">
              {product.badge}
            </em>
          </a>
          <div>
            <p className="font-sans text-xs tracking-wider uppercase">
              {product.category}
            </p>
            <h2 className="my-2 text-2xl leading-none">
              <a
                href={`/product/${product.id}`}
                className="text-ink no-underline"
              >
                {product.name}
              </a>
            </h2>
            <strong>{formatCurrency(product.price)}</strong>
          </div>
          <ProductActionBoundary product={product} />
        </article>
      ))}
    </section>
  );
}
