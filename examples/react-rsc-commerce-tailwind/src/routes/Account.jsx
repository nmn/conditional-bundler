import React from "react";

export default function Account() {
  return (
    <section className="grid grid-cols-2 gap-3.5">
      <div className="col-span-2 mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Account</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          Preferences for a repeat buyer.
        </h1>
      </div>
      {[
        ["Roast profile", "Washed espresso, medium-light"],
        ["Pantry cadence", "Every 4 weeks"],
        ["Preferred delivery", "Friday morning courier"],
        ["Gift wrapping", "Natural paper, no ribbon"],
      ].map(([label, value]) => (
        <article
          key={label}
          className="grid gap-3.5 border-2 border-ink bg-porcelain p-5"
        >
          <span className="font-sans text-xs tracking-wider uppercase">
            {label}
          </span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
