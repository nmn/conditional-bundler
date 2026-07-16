import React, { useState } from "react";
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
  button: {
    backgroundColor: "#b9ff66",
    borderWidth: 0,
    color: "#0f1715",
    cursor: "pointer",
    font: "inherit",
    paddingBlock: 10,
    paddingInline: 14,
  },
});

export default function Settings() {
  const [compact, setCompact] = useState(false);
  return (
    <>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Settings</p>
        <h1 {...stylex.props(styles.title)}>A calmer control surface.</h1>
      </header>
      <article {...stylex.props(styles.card)}>
        <strong>Density</strong>
        <p>{compact ? "Compact rows enabled." : "Comfortable rows enabled."}</p>
        <button
          {...stylex.props(styles.button)}
          onClick={() => setCompact((value) => !value)}
        >
          Toggle density
        </button>
      </article>
    </>
  );
}
