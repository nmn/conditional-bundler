import React from "react";
import * as stylex from "@stylexjs/stylex";

export default function Journal() {
  return (
    <section {...stylex.props(styles.journalLayout)}>
      <article {...stylex.props(styles.panel)}>
        <p {...stylex.props(styles.smallCaps)}>Field notes</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          How we choose objects that survive daily use.
        </h1>
        <p {...stylex.props(styles.lede)}>
          Every item starts as a staff test: dishwasher cycles, countertop
          clutter, grocery runs, and weeknight dinners. The collection changes
          only when the replacement is meaningfully better.
        </p>
      </article>
      <aside {...stylex.props(styles.journalAside)}>
        <span>Issue 07</span>
        <strong>Material honesty beats seasonal novelty.</strong>
      </aside>
    </section>
  );
}

const styles = stylex.create({
  journalLayout: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(220px, .7fr)",
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
  lede: {
    fontSize: 21,
    lineHeight: 1.45,
  },
  journalAside: {
    alignContent: "space-between",
    backgroundColor: "#1b1915",
    color: "#f5eee1",
    display: "grid",
    fontSize: 26,
    padding: 24,
  },
});
