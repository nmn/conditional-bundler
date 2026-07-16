import React from "react";
import * as stylex from "@stylexjs/stylex";
import { CartTable } from "../client/CartTable.jsx";

export default function Cart() {
  return (
    <section>
      <header {...stylex.props(styles.heading)}>
        <p {...stylex.props(styles.smallCaps)}>Cart</p>
        <h1 {...stylex.props(styles.routeTitle)}>
          Reserved in this browser session
        </h1>
      </header>
      <CartTable />
    </section>
  );
}

const styles = stylex.create({
  heading: {
    marginBottom: 24,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  routeTitle: {
    fontSize: "clamp(3rem, 7vw, 7rem)",
    letterSpacing: -4,
    lineHeight: 0.9,
    marginBlock: 6,
  },
});
