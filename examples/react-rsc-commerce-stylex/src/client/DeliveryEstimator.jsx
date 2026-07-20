"use client";

import React, { useState } from "react";
import * as stylex from "@stylexjs/stylex";

export function DeliveryEstimator() {
  const selectId = "delivery-region";
  const [zone, setZone] = useState("local");

  return (
    <section {...stylex.props(styles.tool)}>
      <label {...stylex.props(styles.smallCaps)} htmlFor={selectId}>
        Dispatch estimate
      </label>
      <select
        id={selectId}
        {...stylex.props(styles.select)}
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

const windows = {
  local: "Tomorrow, 2-6 PM",
  regional: "Two business days",
  remote: "Four business days",
};

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
  select: {
    backgroundColor: "#fffaf0",
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#1b1915",
    fontFamily: "inherit",
    paddingBlock: 10,
    paddingInline: 11,
  },
});
