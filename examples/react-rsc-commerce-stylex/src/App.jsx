import React from "react";
import * as stylex from "@stylexjs/stylex";
import monarchMark from "./assets/monarch-mark.svg";
import { BrowserConditionProof } from "./BrowserString.jsx";
import { CartProvider } from "./client/CartContext.jsx";
import { CommerceChrome } from "./client/CommerceChrome.jsx";
import { Router } from "./client/Router.jsx";
import { navItems, resolveRoute } from "./routes.js";

export default async function App({ path, searchParams }) {
  const { id, label, Component } = await resolveRoute(path);
  return (
    <div {...stylex.props(styles.page)}>
      <CartProvider>
        <Router>
          <CommerceChrome path={path}>
            <main {...stylex.props(styles.shell)} data-route={id}>
              <header {...stylex.props(styles.header)}>
                <a href="/" {...stylex.props(styles.brand)}>
                  <span {...stylex.props(styles.brandMark)}>M</span>
                  <span {...stylex.props(styles.brandCopy)}>
                    <strong {...stylex.props(styles.brandTitle)}>
                      Monarch Goods
                    </strong>
                    <small {...stylex.props(styles.smallCaps)}>
                      provisions for precise homes / StyleX
                    </small>
                  </span>
                </a>
                <img
                  {...stylex.props(styles.assetMark)}
                  src={monarchMark.src}
                  width={monarchMark.width}
                  height={monarchMark.height}
                  alt=""
                />
                <nav {...stylex.props(styles.nav)} aria-label="Store">
                  {navItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      aria-current={item.label === label ? "page" : undefined}
                      {...stylex.props(
                        styles.navLink,
                        item.label === label && styles.navLinkActive,
                      )}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </header>
              <BrowserConditionProof />
              <Component path={path} searchParams={searchParams} />
            </main>
          </CommerceChrome>
        </Router>
      </CartProvider>
    </div>
  );
}

const styles = stylex.create({
  page: {
    backgroundColor: "#f5eee1",
    color: "#1b1915",
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    minHeight: "100dvh",
  },
  shell: {
    marginInline: "auto",
    maxWidth: 1380,
    minHeight: "100dvh",
    paddingBlock: 28,
    paddingInline: 32,
    "@media (max-width: 640px)": {
      paddingInline: 16,
    },
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#2f2a22",
    borderBottomStyle: "solid",
    borderBottomWidth: 2,
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(250px, 1fr) auto auto",
    marginBottom: 34,
    paddingBottom: 18,
    "@media (max-width: 820px)": {
      alignItems: "start",
      gridTemplateColumns: "1fr",
    },
  },
  brand: {
    alignItems: "center",
    color: "inherit",
    display: "flex",
    gap: 13,
    textDecoration: "none",
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#1b1915",
    color: "#d7ff45",
    display: "flex",
    fontSize: 22,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  brandCopy: {
    display: "grid",
    gap: 2,
  },
  brandTitle: {
    fontSize: 21,
  },
  smallCaps: {
    fontFamily: '"Avenir Next Condensed", "Franklin Gothic Medium", sans-serif',
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "flex-end",
    "@media (max-width: 820px)": {
      justifyContent: "flex-start",
    },
  },
  navLink: {
    borderColor: "#2f2a22",
    borderStyle: "solid",
    borderWidth: 1,
    color: "inherit",
    paddingBlock: 9,
    paddingInline: 12,
    textDecoration: "none",
    ":focus-visible": {
      outlineColor: "#b64b2f",
      outlineOffset: 3,
      outlineStyle: "solid",
      outlineWidth: 3,
    },
  },
  navLinkActive: {
    backgroundColor: "#d7ff45",
  },
  assetMark: {
    height: 64,
    width: 64,
  },
});
