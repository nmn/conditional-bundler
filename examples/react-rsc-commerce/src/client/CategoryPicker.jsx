"use client";

import React, { useMemo, useState } from "react";

export function CategoryPicker({ categories }) {
  const [selected, setSelected] = useState(categories[0]);
  const message = useMemo(
    () => `${selected} is pinned for this browsing session.`,
    [selected],
  );

  return (
    <section className="home-tool category-picker">
      <p className="eyebrow">Shelf focus</p>
      <div className="tool-segments" aria-label="Shelf focus">
        {categories.map((category) => (
          <button
            type="button"
            aria-pressed={selected === category}
            key={category}
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
