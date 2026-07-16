import React, { useState } from "react";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  header: {
    alignItems: "end",
    display: "flex",
    justifyContent: "space-between",
  },
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
  button: {
    backgroundColor: "#b9ff66",
    borderWidth: 0,
    color: "#0f1715",
    cursor: "pointer",
    font: "inherit",
    paddingBlock: 10,
    paddingInline: 14,
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

export default function Dashboard() {
  const [refreshes, setRefreshes] = useState(0);
  return (
    <>
      <header {...stylex.props(styles.header)}>
        <div>
          <p {...stylex.props(styles.eyebrow)}>Live overview</p>
          <h1 {...stylex.props(styles.title)}>Operations at a glance.</h1>
        </div>
        <button
          {...stylex.props(styles.button)}
          onClick={() => setRefreshes((value) => value + 1)}
        >
          Refreshes: {refreshes}
        </button>
      </header>
      <section {...stylex.props(styles.grid)}>
        {[
          ["Active orders", "128"],
          ["Fill rate", "96.4%"],
          ["At-risk SKUs", "7"],
          ["Dock windows", "14"],
        ].map(([label, value]) => (
          <article key={label} {...stylex.props(styles.card)}>
            <span {...stylex.props(styles.eyebrow)}>{label}</span>
            <strong {...stylex.props(styles.metric)}>{value}</strong>
          </article>
        ))}
      </section>
    </>
  );
}
