import React from "react";
import * as stylex from "@stylexjs/stylex";
import { navItems } from "./router.js";

export function App({ routeId, Route }) {
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.shell)}>
        <aside {...stylex.props(styles.sidebar)}>
          <strong {...stylex.props(styles.brand)}>Greenline Ops</strong>
          <span {...stylex.props(styles.eyebrow)}>StyleX universal SPA</span>
          <nav {...stylex.props(styles.nav)}>
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                {...stylex.props(
                  styles.navLink,
                  item.id === routeId && styles.navActive,
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main {...stylex.props(styles.main)}>
          <Route />
        </main>
      </div>
    </div>
  );
}

const styles = stylex.create({
  page: {
    backgroundColor: "#0f1715",
    color: "#e8f3ee",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    margin: -8,
    minHeight: "100vh",
    padding: 8,
  },
  shell: {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "240px minmax(0, 1fr)",
    marginInline: "auto",
    maxWidth: 1280,
    padding: 28,
  },
  sidebar: {
    alignContent: "start",
    backgroundColor: "#17231f",
    borderColor: "#365249",
    borderStyle: "solid",
    borderWidth: 1,
    display: "grid",
    gap: 16,
    minHeight: "calc(100vh - 56px)",
    padding: 18,
  },
  brand: {
    color: "#b9ff66",
    fontSize: 25,
    letterSpacing: -1,
  },
  eyebrow: {
    color: "#8eb6a8",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nav: {
    display: "grid",
    gap: 8,
  },
  navLink: {
    borderColor: "#365249",
    borderStyle: "solid",
    borderWidth: 1,
    color: "#e8f3ee",
    paddingBlock: 10,
    paddingInline: 12,
    textDecoration: "none",
  },
  navActive: {
    backgroundColor: "#b9ff66",
    color: "#0f1715",
  },
  main: {
    display: "grid",
    gap: 20,
  },
});
