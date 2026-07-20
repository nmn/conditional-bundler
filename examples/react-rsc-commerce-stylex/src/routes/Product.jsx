import React from "react";
import * as stylex from "@stylexjs/stylex";
import {
  findProduct,
  products,
} from "../../../react-rsc-commerce/src/data/catalog.js";
import {
  formatCurrency,
  shippingWindow,
} from "../../../react-rsc-commerce/src/lib/pricing.js";
import { merchandisingNote } from "../../../react-rsc-commerce/src/lib/merchandising.dev.js" with {
  NODE_ENV: "development",
  else: "../../../react-rsc-commerce/src/lib/merchandising.prod.js",
};
import { ProductActionBoundary } from "../components/ProductActionBoundary.jsx";

export default function Product({ path }) {
  const product = findProduct(path.split("/").at(-1));
  const related = products
    .filter(
      (item) => item.category === product.category && item.id !== product.id,
    )
    .slice(0, 3);
  return (
    <section {...stylex.props(styles.detail)}>
      <div
        {...stylex.props(
          styles.detailArt,
          productColors[product.id ?? "copper-kettle"],
        )}
      >
        <span {...stylex.props(styles.detailLabel)}>{product.category}</span>
      </div>
      <div {...stylex.props(styles.detailCopy)}>
        <p {...stylex.props(styles.smallCaps)}>{product.badge}</p>
        <h1 {...stylex.props(styles.routeTitle)}>{product.name}</h1>
        <p {...stylex.props(styles.lede)}>{product.description}</p>
        <div {...stylex.props(styles.metrics)}>
          <span {...stylex.props(styles.metricChip)}>
            {formatCurrency(product.price)}
          </span>
          <span {...stylex.props(styles.metricChip)}>
            {product.rating} rating
          </span>
          <span {...stylex.props(styles.metricChip)}>
            {shippingWindow(product)}
          </span>
        </div>
        <ProductActionBoundary product={product} />
        <p {...stylex.props(styles.merchNote)}>{merchandisingNote(product)}</p>
      </div>
      <aside {...stylex.props(styles.relatedPanel)}>
        <h2>Pairs well</h2>
        {related.map((item) => (
          <a
            key={item.id}
            href={`/product/${item.id}`}
            {...stylex.props(styles.relatedLink)}
          >
            <span
              {...stylex.props(
                styles.relatedSwatch,
                productColors[item.id ?? "copper-kettle"],
              )}
            />
            {item.name}
          </a>
        ))}
      </aside>
    </section>
  );
}

const styles = stylex.create({
  detail: {
    display: "grid",
    gap: 24,
    gridTemplateColumns:
      "minmax(260px, .8fr) minmax(0, 1.2fr) minmax(190px, .45fr)",
  },
  detailArt: {
    alignItems: "flex-end",
    aspectRatio: "0.82",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "flex",
    padding: 20,
  },
  detailLabel: {
    backgroundColor: "#fffaf0",
    paddingBlock: 10,
    paddingInline: 12,
  },
  detailCopy: {
    minWidth: 0,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  routeTitle: {
    fontSize: "clamp(3rem, 7vw, 7rem)",
    letterSpacing: -4,
    lineHeight: 0.9,
    marginBlock: 6,
  },
  lede: {
    fontSize: 21,
    lineHeight: 1.45,
  },
  metrics: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBlock: 20,
  },
  metricChip: {
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 9,
    paddingInline: 11,
  },
  merchNote: {
    borderLeftColor: "#b64b2f",
    borderLeftStyle: "solid",
    borderLeftWidth: 4,
    fontStyle: "italic",
    marginTop: 18,
    paddingLeft: 12,
  },
  relatedPanel: {
    alignSelf: "start",
    borderLeftColor: "#2f2a22",
    borderLeftStyle: "solid",
    borderLeftWidth: 1,
    display: "grid",
    gap: 10,
    paddingLeft: 18,
  },
  relatedLink: {
    alignItems: "center",
    color: "inherit",
    display: "grid",
    gap: 9,
    gridTemplateColumns: "28px 1fr",
    textDecoration: "none",
  },
  relatedSwatch: {
    height: 28,
    width: 28,
  },
});

const productColors = stylex.create({
  "copper-kettle": { backgroundColor: "#b87333" },
  "stoneware-set": { backgroundColor: "#61746a" },
  "market-tote": { backgroundColor: "#d7b56d" },
  "espresso-sampler": { backgroundColor: "#5a3a2e" },
  "preserved-citrus": { backgroundColor: "#e0a72e" },
  "linen-runner": { backgroundColor: "#a8b1a0" },
  "breakfast-club": { backgroundColor: "#db6b42" },
  "maple-granola": { backgroundColor: "#b8803d" },
});
