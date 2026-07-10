import React from "react";
import { Counter } from "./Counter.jsx";
import { DraftPad } from "./DraftPad.jsx";
import { PreferenceSwitch } from "./PreferenceSwitch.jsx";

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">conditional-bundler / RSC</p>
        <h1>Server components with a conditional client branch.</h1>
        <p className="lede">
          This page is built from a server graph and a browser graph without a
          second bundler in the toolchain.
        </p>
      </section>
      <section className="client-grid" aria-label="Client component examples">
        <Counter initialCount={2} />
        <PreferenceSwitch />
        <DraftPad />
      </section>
    </main>
  );
}
