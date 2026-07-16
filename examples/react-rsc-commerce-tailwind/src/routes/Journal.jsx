import React from "react";

export default function Journal() {
  return (
    <section className="grid grid-cols-[minmax(0,1.3fr)_minmax(220px,.7fr)] gap-4.5">
      <article className="grid gap-3.5 border-2 border-ink bg-porcelain p-6">
        <p className="font-sans text-xs tracking-wider uppercase">
          Field notes
        </p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          How we choose objects that survive daily use.
        </h1>
        <p className="text-xl leading-relaxed">
          Every item starts as a staff test: dishwasher cycles, countertop
          clutter, grocery runs, and weeknight dinners. The collection changes
          only when the replacement is meaningfully better.
        </p>
      </article>
      <aside className="grid content-between bg-ink p-6 text-2xl text-paper">
        <span>Issue 07</span>
        <strong>Material honesty beats seasonal novelty.</strong>
      </aside>
    </section>
  );
}
