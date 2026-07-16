"use client";

import React, { useMemo, useState } from "react";
import * as stylex from "@stylexjs/stylex";

export function CategoryPicker({ categories }) {
  const [selected, setSelected] = useState(categories[0]);
  const message = `${selected} is pinned for this browsing session.`;

  return (
    <section {...stylex.props(styles.tool)}>
      <p {...stylex.props(styles.smallCaps)}>Shelf focus</p>
      <div {...stylex.props(styles.buttonRow)} aria-label="Shelf focus">
        {categories.map((category) => (
          <button
            type="button"
            aria-pressed={selected === category}
            key={category}
            {...stylex.props(
              styles.button,
              selected === category && styles.buttonActive,
            )}
            onClick={() => setSelected(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <output>{message}</output>
    </section>
  );
}

const styles = stylex.create({
  tool: {
    display: "grid",
    gap: 13,
    minHeight: 165,
    padding: 20,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
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
  buttonActive: {
    backgroundColor: "#d7ff45",
  },
});
