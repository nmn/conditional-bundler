import React from "react";

export default function Checkout() {
  return (
    <section className="checkout-grid">
      <div className="route-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Three quiet steps from market to doorstep.</h1>
      </div>
      {["Contact", "Delivery", "Payment"].map((step, index) => (
        <article key={step} className="process-card">
          <span>{String(index + 1).padStart(2, "0")}</span>
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
