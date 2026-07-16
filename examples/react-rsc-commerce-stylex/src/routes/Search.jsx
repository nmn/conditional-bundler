import React from "react";
import * as stylex from "@stylexjs/stylex";
import { products } from "../../../react-rsc-commerce/src/data/catalog.js";
import { formatCurrency } from "../../../react-rsc-commerce/src/lib/pricing.js";

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
    <section {...stylex.props(styles.routeStack)}>
      <div {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Search</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          {query ? `Results for "${query}"` : "Popular searches"}
        </h1>
      </div>
      <div {...stylex.props(styles.searchList)}>
        {results.map((product) => (
          <a
            key={product.id}
            href={`/product/${product.id}`}
            {...stylex.props(styles.searchItem)}
          >
            <span
              {...stylex.props(
                styles.searchSwatch,
                productColors[product.id ?? "copper-kettle"],
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

const styles = stylex.create({
  routeStack: {
    display: "grid",
    gap: 18,
  },
  heading: {
    marginBottom: 24,
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
  searchList: {
    borderTopColor: "#2f2a22",
    borderTopStyle: "solid",
    borderTopWidth: 1,
    display: "grid",
  },
  searchItem: {
    alignItems: "center",
    borderBottomColor: "#2f2a22",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    color: "inherit",
    display: "grid",
    gap: 14,
    gridTemplateColumns: "42px 1fr auto",
    paddingBlock: 14,
    textDecoration: "none",
  },
  searchSwatch: {
    height: 42,
    width: 42,
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
