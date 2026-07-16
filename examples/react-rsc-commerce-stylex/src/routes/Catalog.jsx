import React from "react";
import * as stylex from "@stylexjs/stylex";
import {
  categories,
  products,
} from "../../../react-rsc-commerce/src/data/catalog.js";
import { ProductGrid } from "../ProductGrid.jsx";

export default function Catalog({ searchParams }) {
  const active = searchParams.category ?? "All";
  const selected =
    active === "All"
      ? products
      : products.filter((product) => product.category === active);
  return (
    <section>
      <header {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Catalog</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          {active === "All" ? "Everything in stock" : active}
        </h1>
      </header>
      <nav {...stylex.props(styles.categoryNav)} aria-label="Categories">
        {categories.map((category) => (
          <a
            key={category}
            href={
              category === "All" ? "/catalog" : `/catalog?category=${category}`
            }
            aria-current={category === active ? "page" : undefined}
            {...stylex.props(
              styles.navLink,
              category === active && styles.navLinkActive,
            )}
          >
            {category}
          </a>
        ))}
      </nav>
      <ProductGrid products={selected} />
    </section>
  );
}

const styles = stylex.create({
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
  categoryNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  navLink: {
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "inherit",
    paddingBlock: 9,
    paddingInline: 12,
    textDecoration: "none",
  },
  navLinkActive: {
    backgroundColor: "#d7ff45",
  },
});
