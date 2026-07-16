import React from "react";
import basicMark from "./assets/basic-mark.svg";
import "./showcase.css";
import { Counter } from "./Counter.jsx";
import { DraftPad } from "./DraftPad.jsx";
import { PreferenceSwitch } from "./PreferenceSwitch.jsx";

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <img
          className="asset-proof-mark"
          src={basicMark.src}
          width={basicMark.width}
          height={basicMark.height}
          alt=""
        />
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
