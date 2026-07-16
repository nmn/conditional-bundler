import React from "react";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  eyebrow: {
    color: "#8eb6a8",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(2.8rem, 6vw, 5.8rem)",
    letterSpacing: -4,
    lineHeight: 0.92,
    marginBlock: 4,
  },
  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  },
  card: {
    backgroundColor: "#17231f",
    borderColor: "#365249",
    borderStyle: "solid",
    borderWidth: 1,
    display: "grid",
    gap: 12,
    minHeight: 150,
    padding: 18,
  },
  metric: {
    color: "#b9ff66",
    fontSize: 42,
  },
});

export default function Inventory() {
  return (
    <>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Inventory</p>
        <h1 {...stylex.props(styles.title)}>Stock without guesswork.</h1>
      </header>
      <section {...stylex.props(styles.grid)}>
        {["Copper kettle", "Stoneware", "Espresso", "Linen runner"].map(
          (item, index) => (
            <article key={item} {...stylex.props(styles.card)}>
              <strong>{item}</strong>
              <span {...stylex.props(styles.metric)}>{42 - index * 7}</span>
              <span>units available</span>
            </article>
          ),
        )}
      </section>
    </>
  );
}
