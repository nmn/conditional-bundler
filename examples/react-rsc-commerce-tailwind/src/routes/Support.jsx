import React from "react";

export default function Support() {
  return (
    <section className="grid grid-cols-3 gap-3.5">
      <div className="col-span-3 mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Support</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          Real people, useful answers, no ticket maze.
        </h1>
      </div>
      {[
        [
          "Delivery changes",
          "Move a delivery window until 6pm the night before.",
        ],
        ["Product care", "Get cleaning, seasoning, and storage instructions."],
        ["Trade orders", "Open a quote for restaurants, studios, and offices."],
      ].map(([title, body]) => (
        <article key={title} className="border-2 border-ink bg-porcelain p-5">
          <h2>{title}</h2>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}
