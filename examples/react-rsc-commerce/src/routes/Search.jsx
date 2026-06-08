import React from "react";
import { products } from "../data/catalog.js";
import { formatCurrency } from "../lib/pricing.js";

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
    <section className="route-stack">
      <div className="route-heading">
        <p className="eyebrow">Search</p>
        <h1>{query ? `Results for "${query}"` : "Popular searches"}</h1>
      </div>
      <div className="search-list">
        {results.map((product) => (
          <a key={product.id} href={`/product/${product.id}`}>
            <span style={{ background: product.color }} />
            <strong>{product.name}</strong>
            <em>{formatCurrency(product.price)}</em>
          </a>
        ))}
      </div>
    </section>
  );
}
