"use client";

import React, { useState } from "react";
import { useExampleLog } from "./useExampleLog.dev.jsx" with {
  condition: "DEV",
  else: "./useExampleLog.noop.jsx",
};

export function Counter({ initialCount }) {
  const [count, setCount] = useState(initialCount);
  useExampleLog("Counter mounted through the DEV branch.");

  return (
    <section className="client-panel counter">
      <div>
        <p className="label">Client island</p>
        <strong>{count}</strong>
      </div>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Increment
      </button>
    </section>
  );
}
