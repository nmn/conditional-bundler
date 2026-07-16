"use client";

import React, { useMemo, useState } from "react";
import { classes } from "../classes.js";

export function CategoryPicker({ categories }) {
  const [selected, setSelected] = useState(categories[0]);
  const message = useMemo(
    () => `${selected} is pinned for this browsing session.`,
    [selected],
  );

  return (
    <section className="grid min-h-40 gap-3 p-5">
      <p className="font-sans text-xs tracking-wider uppercase">Shelf focus</p>
      <div className="flex flex-wrap gap-1.5" aria-label="Shelf focus">
        {categories.map((category) => (
          <button
            type="button"
            aria-pressed={selected === category}
            key={category}
            className={classes(
              "cursor-pointer border border-ink px-3 py-2",
              selected === category ? "bg-acid" : "bg-porcelain",
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
