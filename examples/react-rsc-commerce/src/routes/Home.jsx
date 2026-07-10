import React from "react";
import { ProductActionBoundary } from "../components/ProductActionBoundary.jsx";
import { CategoryPicker } from "../client/CategoryPicker.jsx";
import { DeliveryEstimator } from "../client/DeliveryEstimator.jsx";
import { HomeCounter } from "../client/HomeCounter.jsx";
import { featuredProducts } from "../data/catalog.js";
import { formatCurrency } from "../lib/pricing.js";

export default function Home() {
  const featured = featuredProducts();
  const categories = Array.from(
    new Set(featured.map((product) => product.category)),
  );
  return (
    <>
      <section className="hero-commerce">
        <div>
          <p className="eyebrow">Spring market drop</p>
          <h1>Housewares, pantry goods, and coffee with a point of view.</h1>
        </div>
        <aside>
          <strong>48h</strong>
          <span>average fulfillment for stocked goods</span>
          <HomeCounter />
        </aside>
      </section>
      <section className="home-client-tools" aria-label="Store preferences">
        <CategoryPicker categories={categories} />
        <DeliveryEstimator />
      </section>
      <section className="product-grid featured-grid">
        {featured.map((product) => (
          <article className="product-card" key={product.id}>
            <a href={`/product/${product.id}`} className="product-visual">
              <span style={{ background: product.color }} />
              <em>{product.badge}</em>
            </a>
            <div>
              <p>{product.category}</p>
              <h2>
                <a href={`/product/${product.id}`}>{product.name}</a>
              </h2>
              <strong>{formatCurrency(product.price)}</strong>
            </div>
            <ProductActionBoundary product={product} />
          </article>
        ))}
      </section>
    </>
  );
}
