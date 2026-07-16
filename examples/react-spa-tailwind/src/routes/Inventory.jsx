import React from "react";

export default function Inventory() {
  return (
    <>
      <header>
        <p className="font-mono text-xs tracking-wider text-muted uppercase">
          Inventory
        </p>
        <h1 className="my-1 text-[clamp(2.8rem,6vw,5.8rem)] leading-[.92] tracking-[-.06em]">
          Stock without guesswork.
        </h1>
      </header>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {["Copper kettle", "Stoneware", "Espresso", "Linen runner"].map(
          (item, index) => (
            <article
              key={item}
              className="grid min-h-36 gap-3 border border-line bg-panel p-4.5"
            >
              <strong>{item}</strong>
              <span className="text-4xl text-pop">{42 - index * 7}</span>
              <span>units available</span>
            </article>
          ),
        )}
      </section>
    </>
  );
}
