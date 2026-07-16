import React from "react";
import {
  findProduct,
  products,
} from "../../../react-rsc-commerce/src/data/catalog.js";
import {
  formatCurrency,
  shippingWindow,
} from "../../../react-rsc-commerce/src/lib/pricing.js";
import { merchandisingNote } from "../../../react-rsc-commerce/src/lib/merchandising.dev.js" with {
  condition: "DEV",
  else: "../../../react-rsc-commerce/src/lib/merchandising.prod.js",
};
import { ProductActionBoundary } from "../components/ProductActionBoundary.jsx";
import { classes, productColorClass } from "../classes.js";

export default function Product({ path }) {
  const product = findProduct(path.split("/").at(-1));
  const related = products
    .filter(
      (item) => item.category === product.category && item.id !== product.id,
    )
    .slice(0, 3);
  return (
    <section className="grid grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)_minmax(190px,.45fr)] gap-6">
      <div
        className={classes(
          "flex aspect-[.82] items-end border-2 border-ink p-5",
          productColorClass(product.id),
        )}
      >
        <span className="bg-porcelain px-3 py-2.5">{product.category}</span>
      </div>
      <div>
        <p className="font-sans text-xs tracking-wider uppercase">
          {product.badge}
        </p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          {product.name}
        </h1>
        <p className="text-xl leading-relaxed">{product.description}</p>
        <div className="my-5 flex flex-wrap gap-2">
          <span className="border border-ink px-3 py-2">
            {formatCurrency(product.price)}
          </span>
          <span className="border border-ink px-3 py-2">
            {product.rating} rating
          </span>
          <span className="border border-ink px-3 py-2">
            {shippingWindow(product)}
          </span>
        </div>
        <ProductActionBoundary product={product} />
        <p className="mt-4 border-l-4 border-oxide pl-3 italic">
          {merchandisingNote(product)}
        </p>
      </div>
      <aside className="grid content-start gap-2.5 border-l border-ink pl-4.5">
        <h2>Pairs well</h2>
        {related.map((item) => (
          <a
            key={item.id}
            href={`/product/${item.id}`}
            className="grid grid-cols-[28px_1fr] items-center gap-2 text-ink no-underline"
          >
            <span className={classes("h-7 w-7", productColorClass(item.id))} />
            {item.name}
          </a>
        ))}
      </aside>
    </section>
  );
}
