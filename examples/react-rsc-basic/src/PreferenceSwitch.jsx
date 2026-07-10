"use client";

import React, { useMemo, useState } from "react";

const preferences = ["Paper", "Ink"];

export function PreferenceSwitch() {
  const [preference, setPreference] = useState(preferences[0]);
  const description = useMemo(
    () =>
      preference === "Paper"
        ? "Quiet surfaces and high contrast."
        : "Dense surfaces and low glare.",
    [preference],
  );

  return (
    <section className="client-panel preference-switch">
      <p className="label">Display preference</p>
      <div className="segmented" aria-label="Display preference">
        {preferences.map((item) => (
          <button
            type="button"
            aria-pressed={preference === item}
            key={item}
            onClick={() => setPreference(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="client-status">{description}</p>
    </section>
  );
}
