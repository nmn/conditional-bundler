import React from "react";

export default function Support() {
  return (
    <section className="support-grid">
      <div className="route-heading">
        <p className="eyebrow">Support</p>
        <h1>Real people, useful answers, no ticket maze.</h1>
      </div>
      {[
        [
          "Delivery changes",
          "Move a delivery window until 6pm the night before.",
        ],
        ["Product care", "Get cleaning, seasoning, and storage instructions."],
        ["Trade orders", "Open a quote for restaurants, studios, and offices."],
      ].map(([title, body]) => (
        <article key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}
