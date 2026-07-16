import React from "react";
import {
  categories,
  products,
} from "../../../react-rsc-commerce/src/data/catalog.js";
import { classes } from "../classes.js";
import { ProductGrid } from "../ProductGrid.jsx";

export default function Catalog({ searchParams }) {
  const active = searchParams.category ?? "All";
  const selected =
    active === "All"
      ? products
      : products.filter((product) => product.category === active);
  return (
    <section>
      <header className="mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Catalog</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          {active === "All" ? "Everything in stock" : active}
        </h1>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Categories">
        {categories.map((category) => (
          <a
            key={category}
            href={
              category === "All" ? "/catalog" : `/catalog?category=${category}`
            }
            aria-current={category === active ? "page" : undefined}
            className={classes(
              "border border-ink px-3 py-2 text-ink no-underline",
              category === active && "bg-acid",
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
