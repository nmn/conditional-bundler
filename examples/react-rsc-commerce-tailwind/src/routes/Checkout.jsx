import React from "react";

export default function Checkout() {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="col-span-3 mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Checkout</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          Three quiet steps from market to doorstep.
        </h1>
      </div>
      {["Contact", "Delivery", "Payment"].map((step, index) => (
        <article
          key={step}
          className="grid min-h-60 gap-3.5 border-2 border-ink bg-porcelain p-5"
        >
          <span className="text-5xl">{String(index + 1).padStart(2, "0")}</span>
          <h2>{step}</h2>
          <p>
            {index === 0
              ? "Use your account details or continue as a guest."
              : index === 1
                ? "Choose courier delivery, pickup, or a monthly subscription window."
                : "Review taxes, credits, gift notes, and final authorization."}
          </p>
        </article>
      ))}
    </section>
  );
}
