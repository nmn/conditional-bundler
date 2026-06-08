import React from "react";
import { CartTable } from "../client/CartTable.jsx";

export default function Cart() {
  return (
    <section className="route-stack">
      <div className="route-heading">
        <p className="eyebrow">Cart</p>
        <h1>Reserved in this browser session</h1>
      </div>
      <CartTable />
    </section>
  );
}
