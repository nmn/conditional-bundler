"use client";

import React, { useState } from "react";
import { useExampleLog } from "./useExampleLog.dev.jsx" with {
  NODE_ENV: "development",
  else: "./useExampleLog.noop.jsx",
};

export function Counter({ initialCount }) {
  const [count, setCount] = useState(initialCount);
  useExampleLog("Counter mounted through the development branch.");

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
