"use client";

import React, { useState } from "react";

export function HomeCounter() {
  const [count, setCount] = useState(0);

  return (
    <div className="home-counter">
      <span>Counter</span>
      <strong>{count}</strong>
      <div>
        <button
          type="button"
          aria-label="Decrease counter"
          onClick={() => setCount((value) => value - 1)}
        >
          -
        </button>
        <button
          type="button"
          aria-label="Reset counter"
          onClick={() => setCount(0)}
        >
          Reset
        </button>
        <button
          type="button"
          aria-label="Increase counter"
          onClick={() => setCount((value) => value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
