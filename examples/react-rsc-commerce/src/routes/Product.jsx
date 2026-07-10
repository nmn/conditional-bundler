import React from "react";
import { ProductActionBoundary } from "../components/ProductActionBoundary.jsx";
import { findProduct, products } from "../data/catalog.js";
import { formatCurrency, shippingWindow } from "../lib/pricing.js";
import { merchandisingNote } from "../lib/merchandising.dev.js" with {
  condition: "DEV",
  else: "../lib/merchandising.prod.js",
};

export default function Product({ path }) {
  const id = path.split("/").at(-1);
  const product = findProduct(id);
  const related = products
    .filter(
      (item) => item.category === product.category && item.id !== product.id,
    )
    .slice(0, 3);

  return (
    <section className="product-detail">
      <div className="detail-art" style={{ "--product-color": product.color }}>
        <span>{product.category}</span>
      </div>
      <div className="detail-copy">
        <p className="eyebrow">{product.badge}</p>
        <h1>{product.name}</h1>
        <p className="lede">{product.description}</p>
        <div className="detail-metrics">
          <span>{formatCurrency(product.price)}</span>
          <span>{product.rating} rating</span>
          <span>{shippingWindow(product)}</span>
        </div>
        <ProductActionBoundary product={product} />
        <p className="merch-note">{merchandisingNote(product)}</p>
      </div>
      <aside className="related-panel">
        <h2>Pairs well</h2>
        {related.map((item) => (
          <a key={item.id} href={`/product/${item.id}`}>
            <span style={{ background: item.color }} />
            {item.name}
          </a>
        ))}
      </aside>
    </section>
  );
}
