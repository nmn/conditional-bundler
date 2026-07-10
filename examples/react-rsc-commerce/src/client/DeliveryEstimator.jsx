"use client";

import React, { useId, useState } from "react";

const windows = {
  local: "Tomorrow, 2-6 PM",
  regional: "Two business days",
  remote: "Four business days",
};

export function DeliveryEstimator() {
  const selectId = useId();
  const [zone, setZone] = useState("local");

  return (
    <section className="home-tool delivery-estimator">
      <label className="eyebrow" htmlFor={selectId}>
        Dispatch estimate
      </label>
      <select
        id={selectId}
        onChange={(event) => setZone(event.target.value)}
        value={zone}
      >
        <option value="local">Local</option>
        <option value="regional">Regional</option>
        <option value="remote">Remote</option>
      </select>
      <output>{windows[zone]}</output>
    </section>
  );
}
