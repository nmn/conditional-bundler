import React from "react";
import * as stylex from "@stylexjs/stylex";

export default function Support() {
  return (
    <section {...stylex.props(styles.supportGrid)}>
      <div {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Support</p>
        <h1 {...stylex.props(styles.routeTitle)}>
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
        <article key={title} {...stylex.props(styles.panel)}>
          <h2>{title}</h2>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}

const styles = stylex.create({
  supportGrid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
    padding: 20,
  },
});
