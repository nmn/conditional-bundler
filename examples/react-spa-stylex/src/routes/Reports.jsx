import React from "react";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  eyebrow: {
    color: "#8eb6a8",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(2.8rem, 6vw, 5.8rem)",
    letterSpacing: -4,
    lineHeight: 0.92,
    marginBlock: 4,
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
  },
  cell: {
    borderBottomColor: "#365249",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBlock: 12,
    textAlign: "left",
  },
});

export default function Reports() {
  return (
    <>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Reports</p>
        <h1 {...stylex.props(styles.title)}>Signals, not spreadsheet fog.</h1>
      </header>
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            {["Region", "Orders", "Revenue"].map((label) => (
              <th key={label} {...stylex.props(styles.cell)}>
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
                <td key={value} {...stylex.props(styles.cell)}>
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
