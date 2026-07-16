"use client";

import React, { useState } from "react";

export function HomeCounter() {
  const [count, setCount] = useState(0);

  return (
    <div className="grid gap-2 border-t border-ink pt-3">
      <span>Counter</span>
      <strong className="text-4xl">{count}</strong>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-label="Decrease counter"
          className="cursor-pointer border border-ink bg-porcelain px-3 py-2 text-ink"
          onClick={() => setCount((value) => value - 1)}
        >
          -
        </button>
        <button
          type="button"
          aria-label="Reset counter"
          className="cursor-pointer border border-ink bg-porcelain px-3 py-2 text-red"
          onClick={() => setCount(0)}
        >
          Reset
        </button>
        <button
          type="button"
          aria-label="Increase counter"
          className="cursor-pointer border border-ink bg-porcelain px-3 py-2 text-ink"
          onClick={() => setCount((value) => value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
