import React from "react";
import { featuredProducts } from "../../../react-rsc-commerce/src/data/catalog.js";
import { CategoryPicker } from "../client/CategoryPicker.jsx";
import { DeliveryEstimator } from "../client/DeliveryEstimator.jsx";
import { HomeCounter } from "../client/HomeCounter.jsx";
import { ProductGrid } from "../ProductGrid.jsx";

export default function Home() {
  const products = featuredProducts();
  const categories = Array.from(
    new Set(products.map((product) => product.category)),
  );
  return (
    <>
      <section className="mb-8 grid grid-cols-[minmax(0,1fr)_minmax(240px,340px)] gap-6">
        <div>
          <p className="font-sans text-xs tracking-wider uppercase">
            Spring market drop
          </p>
          <h1 className="my-2 text-[clamp(3rem,7vw,7.4rem)] leading-[.88] tracking-[-.06em]">
            Housewares, pantry goods, and coffee with a point of view.
          </h1>
        </div>
        <aside className="grid gap-3.5 border-2 border-ink bg-porcelain p-5">
          <strong className="text-7xl leading-none">48h</strong>
          <span>average fulfillment for stocked goods</span>
          <HomeCounter />
        </aside>
      </section>
      <section
        className="mb-8 grid grid-cols-2 border-y-2 border-ink"
        aria-label="Store preferences"
      >
        <CategoryPicker categories={categories} />
        <DeliveryEstimator />
      </section>
      <ProductGrid products={products} />
    </>
  );
}
