import React from "react";
import { CartTable } from "../client/CartTable.jsx";

export default function Cart() {
  return (
    <section>
      <header className="mb-6">
        <p className="font-sans text-xs tracking-wider uppercase">Cart</p>
        <h1 className="my-1.5 text-[clamp(3rem,7vw,7rem)] leading-[.9] tracking-[-.06em]">
          Reserved in this browser session
        </h1>
      </header>
      <CartTable />
    </section>
  );
}
