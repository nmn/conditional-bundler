import React from "react";
import { products } from "../../../react-rsc-commerce/src/data/catalog.js";
import { formatCurrency } from "../../../react-rsc-commerce/src/lib/pricing.js";
import { classes, productColorClass } from "../classes.js";

export default function Search({ searchParams }) {
  const query = (searchParams.q ?? "").toLowerCase();
  const results = query
    ? products.filter((product) =>
        `${product.name} ${product.category} ${product.description}`
          .toLowerCase()
          .includes(query),
      )
    : products.slice(0, 5);

  return (
    <section className="grid gap-4.5">
      <div className="mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Search</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          {query ? `Results for "${query}"` : "Popular searches"}
        </h1>
      </div>
      <div className="grid border-t border-ink">
        {results.map((product) => (
          <a
            key={product.id}
            href={`/product/${product.id}`}
            className="grid grid-cols-[42px_1fr_auto] items-center gap-3.5 border-b border-ink py-3.5 text-ink no-underline"
          >
            <span
              className={classes(
                "h-10.5 w-10.5",
                productColorClass(product.id),
              )}
            />
            <strong>{product.name}</strong>
            <em>{formatCurrency(product.price)}</em>
          </a>
        ))}
      </div>
    </section>
  );
}
