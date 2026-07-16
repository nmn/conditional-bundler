import React, { useState } from "react";

export default function Dashboard() {
  const [refreshes, setRefreshes] = useState(0);
  return (
    <>
      <header className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted uppercase">
            Live overview
          </p>
          <h1 className="my-1 text-[clamp(2.8rem,6vw,5.8rem)] leading-[.92] tracking-[-.06em]">
            Operations at a glance.
          </h1>
        </div>
        <button
          className="cursor-pointer border-0 bg-pop px-3.5 py-2.5 text-night"
          onClick={() => setRefreshes((value) => value + 1)}
        >
          Refresh {refreshes}
        </button>
      </header>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {[
          ["Active orders", "128"],
          ["Fill rate", "96.4%"],
          ["At-risk SKUs", "7"],
          ["Dock windows", "14"],
        ].map(([label, value]) => (
          <article
            key={label}
            className="grid min-h-36 gap-3 border border-line bg-panel p-4.5"
          >
            <span className="font-mono text-xs tracking-wider text-muted uppercase">
              {label}
            </span>
            <strong className="text-4xl text-pop">{value}</strong>
          </article>
        ))}
      </section>
    </>
  );
}
