"use client";

import { useState } from "react";
import { useExampleLog } from "./useExampleLog.dev.jsx" with {
  condition: "__DEV__",
  else: "./useExampleLog.noop.jsx",
};

export function Counter({ initialCount }) {
  const [count, setCount] = useState(initialCount);
  useExampleLog("Counter mounted through the __DEV__ branch.");

  return (
    <section className="counter">
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
