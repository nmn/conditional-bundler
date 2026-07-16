import React from "react";

export default function Reports() {
  return (
    <>
      <header>
        <p className="font-mono text-xs tracking-wider text-muted uppercase">
          Reports
        </p>
        <h1 className="my-1 text-[clamp(2.8rem,6vw,5.8rem)] leading-[.92] tracking-[-.06em]">
          Signals, not spreadsheet fog.
        </h1>
      </header>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Region", "Orders", "Revenue"].map((label) => (
              <th key={label} className="border-b border-line py-3 text-left">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["West", "482", "$84k"],
            ["Central", "361", "$61k"],
            ["East", "527", "$92k"],
          ].map((row) => (
            <tr key={row[0]}>
              {row.map((value) => (
                <td key={value} className="border-b border-line py-3">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
