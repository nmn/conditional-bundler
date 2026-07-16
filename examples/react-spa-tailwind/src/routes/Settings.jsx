import React, { useState } from "react";

export default function Settings() {
  const [compact, setCompact] = useState(false);
  return (
    <>
      <header>
        <p className="font-mono text-xs tracking-wider text-muted uppercase">
          Settings
        </p>
        <h1 className="my-1 text-[clamp(2.8rem,6vw,5.8rem)] leading-[.92] tracking-[-.06em]">
          A calmer control surface.
        </h1>
      </header>
      <article className="grid min-h-36 gap-3 border border-line bg-panel p-4.5">
        <strong>Density</strong>
        <p>{compact ? "Compact rows enabled." : "Comfortable rows enabled."}</p>
        <button
          className="cursor-pointer border-0 bg-pop px-3.5 py-2.5 text-night"
          onClick={() => setCompact((value) => !value)}
        >
          Toggle density
        </button>
      </article>
    </>
  );
}
