import React from "react";

export default function Account() {
  return (
    <section className="account-grid">
      <div className="route-heading">
        <p className="eyebrow">Account</p>
        <h1>Preferences for a repeat buyer.</h1>
      </div>
      {[
        ["Roast profile", "Washed espresso, medium-light"],
        ["Pantry cadence", "Every 4 weeks"],
        ["Preferred delivery", "Friday morning courier"],
        ["Gift wrapping", "Natural paper, no ribbon"],
      ].map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
