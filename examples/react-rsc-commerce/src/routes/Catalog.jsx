import React from "react";
import { categories, productsByCategory } from "../data/catalog.js";
import { ProductActions } from "../client/ProductActions.jsx";
import { formatCurrency, shippingWindow } from "../lib/pricing.js";

export default function Catalog({ searchParams }) {
  const category = searchParams.category ?? "All";
  const products = productsByCategory(category);

  return (
    <section className="catalog-layout">
      <div className="route-heading">
        <p className="eyebrow">Catalog</p>
        <h1>{category === "All" ? "Everything in stock" : category}</h1>
      </div>
      <nav className="category-strip" aria-label="Categories">
        {categories.map((item) => (
          <a
            key={item}
            href={item === "All" ? "/catalog" : `/catalog?category=${item}`}
            aria-current={item === category ? "page" : undefined}
          >
            {item}
          </a>
        ))}
      </nav>
      <div className="product-grid">
        {products.map((product) => (
          <article className="product-card compact" key={product.id}>
            <a href={`/product/${product.id}`} className="product-visual">
              <span style={{ background: product.color }} />
              <em>{product.rating} rated</em>
            </a>
            <div>
              <p>{shippingWindow(product)}</p>
              <h2>
                <a href={`/product/${product.id}`}>{product.name}</a>
              </h2>
              <strong>{formatCurrency(product.price)}</strong>
            </div>
            <ProductActions product={product} />
          </article>
        ))}
      </div>
    </section>
  );
}
