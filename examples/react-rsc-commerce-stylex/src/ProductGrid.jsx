import React from "react";
import * as stylex from "@stylexjs/stylex";
import { ProductActionBoundary } from "./components/ProductActionBoundary.jsx";
import { formatCurrency } from "../../react-rsc-commerce/src/lib/pricing.js";

const productColors = stylex.create({
  copperKettle: { backgroundColor: "#b87333" },
  stonewareSet: { backgroundColor: "#61746a" },
  marketTote: { backgroundColor: "#d7b56d" },
  espressoSampler: { backgroundColor: "#5a3a2e" },
  preservedCitrus: { backgroundColor: "#e0a72e" },
  linenRunner: { backgroundColor: "#a8b1a0" },
  breakfastClub: { backgroundColor: "#db6b42" },
  mapleGranola: { backgroundColor: "#b8803d" },
});

const productStyleMap = {
  "copper-kettle": productColors.copperKettle,
  "stoneware-set": productColors.stonewareSet,
  "market-tote": productColors.marketTote,
  "espresso-sampler": productColors.espressoSampler,
  "preserved-citrus": productColors.preservedCitrus,
  "linen-runner": productColors.linenRunner,
  "breakfast-club": productColors.breakfastClub,
  "maple-granola": productColors.mapleGranola,
};

function productColorStyle(productId) {
  return productStyleMap[productId] ?? productColors.copperKettle;
}

export function ProductGrid({ products }) {
  return (
    <section {...stylex.props(styles.grid)}>
      {products.map((product) => (
        <article key={product.id} {...stylex.props(styles.productCard)}>
          <a
            href={`/product/${product.id}`}
            {...stylex.props(styles.productVisual)}
          >
            <span
              {...stylex.props(styles.swatch, productColorStyle(product.id))}
            />
            <em {...stylex.props(styles.badge)}>{product.badge}</em>
          </a>
          <div>
            <p {...stylex.props(styles.smallCaps)}>{product.category}</p>
            <h2>
              <a
                href={`/product/${product.id}`}
                {...stylex.props(styles.cardTitle)}
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

const styles = stylex.create({
  grid: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
  },
  productCard: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "grid",
    gap: 15,
    padding: 14,
  },
  productVisual: {
    alignItems: "center",
    aspectRatio: "1.18",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#1b1915",
    display: "flex",
    justifyContent: "center",
    position: "relative",
    textDecoration: "none",
  },
  swatch: {
    borderRadius: "999px",
    height: "58%",
    width: "58%",
  },
  badge: {
    backgroundColor: "#d7ff45",
    bottom: 10,
    fontStyle: "normal",
    left: 10,
    paddingBlock: 6,
    paddingInline: 9,
    position: "absolute",
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "inherit",
    fontSize: 23,
    lineHeight: 1,
    textDecoration: "none",
  },
});
