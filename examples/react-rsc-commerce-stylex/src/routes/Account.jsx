import React from "react";
import * as stylex from "@stylexjs/stylex";

export default function Account() {
  return (
    <section {...stylex.props(styles.accountGrid)}>
      <div {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Account</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          Preferences for a repeat buyer.
        </h1>
      </div>
      {[
        ["Roast profile", "Washed espresso, medium-light"],
        ["Pantry cadence", "Every 4 weeks"],
        ["Preferred delivery", "Friday morning courier"],
        ["Gift wrapping", "Natural paper, no ribbon"],
      ].map(([label, value]) => (
        <article key={label} {...stylex.props(styles.panel)}>
          <span {...stylex.props(styles.smallCaps)}>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

const styles = stylex.create({
  accountGrid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  heading: {
    gridColumn: "1 / -1",
    marginBottom: 24,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  routeTitle: {
    fontSize: "clamp(3rem, 7vw, 7rem)",
    letterSpacing: -4,
    lineHeight: 0.9,
    marginBlock: 6,
  },
  panel: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 2,
    display: "grid",
    gap: 14,
    padding: 20,
  },
});
