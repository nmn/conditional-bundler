import React from "react";
import * as stylex from "@stylexjs/stylex";
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
      <section {...stylex.props(styles.hero)}>
        <div>
          <p {...stylex.props(styles.smallCaps)}>Spring market drop</p>
          <h1 {...stylex.props(styles.heroTitle)}>
            Housewares, pantry goods, and coffee with a point of view.
          </h1>
        </div>
        <aside {...stylex.props(styles.panel)}>
          <strong {...stylex.props(styles.metric)}>48h</strong>
          <span>average fulfillment for stocked goods</span>
          <HomeCounter />
        </aside>
      </section>
      <section {...stylex.props(styles.tools)} aria-label="Store preferences">
        <CategoryPicker categories={categories} />
        <DeliveryEstimator />
      </section>
      <ProductGrid products={products} />
    </>
  );
}

const styles = stylex.create({
  hero: {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 340px)",
    marginBottom: 30,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(3rem, 7vw, 7.4rem)",
    letterSpacing: -5,
    lineHeight: 0.88,
    marginBlock: 8,
  },
  panel: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "grid",
    gap: 14,
    padding: 20,
  },
  metric: {
    fontSize: 70,
    lineHeight: 0.9,
  },
  tools: {
    borderBlockColor: "#2f2a22",
    borderBlockStyle: "solid",
    borderBlockWidth: 2,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    marginBottom: 30,
  },
});
