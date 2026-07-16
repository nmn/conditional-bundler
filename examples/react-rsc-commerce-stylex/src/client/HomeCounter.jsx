"use client";

import React, { useState } from "react";
import * as stylex from "@stylexjs/stylex";

export function HomeCounter() {
  const [count, setCount] = useState(0);

  return (
    <div {...stylex.props(styles.homeCounter)}>
      <span>Counter</span>
      <strong {...stylex.props(styles.counterValue)}>{count}</strong>
      <div {...stylex.props(styles.buttonRow)}>
        <button
          type="button"
          aria-label="Decrease counter"
          {...stylex.props(styles.button)}
          onClick={() => setCount((value) => value - 1)}
        >
          -
        </button>
        <button
          type="button"
          aria-label="Reset counter"
          {...stylex.props(styles.button)}
          onClick={() => setCount(0)}
        >
          Reset
        </button>
        <button
          type="button"
          aria-label="Increase counter"
          {...stylex.props(styles.button)}
          onClick={() => setCount((value) => value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

const styles = stylex.create({
  homeCounter: {
    borderTopColor: "#2f2a22",
    borderTopStyle: "solid",
    borderTopWidth: 1,
    display: "grid",
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
  },
  counterValue: {
    fontSize: 34,
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  button: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#1b1915",
    cursor: "pointer",
    fontFamily: "inherit",
    paddingBlock: 9,
    paddingInline: 11,
  },
});
