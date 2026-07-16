import React from "react";
import monarchMark from "./assets/monarch-mark.svg";
import moduleStyles from "./App.module.css";
import "./showcase.css";
import "./lib/commerceTelemetry.dev.js" with {
  condition: "__DEV__",
  else: "./lib/commerceTelemetry.prod.js",
};
import { CartProvider } from "./client/CartContext.jsx";
import { CommerceChrome } from "./client/CommerceChrome.jsx";
import { resolveRoute, navItems } from "./router.js";

export default async function App({ path, searchParams }) {
  const { id, label, Component } = await resolveRoute(path);
  return (
    <CartProvider>
      <CommerceChrome path={path}>
        <main
          className={`app-shell ${moduleStyles.moduleProof}`}
          data-route={id}
        >
          <header className="store-header">
            <a className="brand" href="/">
              <span className="brand-mark">M</span>
              <span>
                <strong>Monarch Goods</strong>
                <small>provisions for precise homes</small>
              </span>
            </a>
            <img
              className={`asset-proof-mark ${moduleStyles.mark}`}
              src={monarchMark.src}
              width={monarchMark.width}
              height={monarchMark.height}
              alt=""
            />
            <nav className="nav-strip" aria-label="Store">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={item.label === label ? "page" : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </header>
          <Component path={path} searchParams={searchParams} />
        </main>
      </CommerceChrome>
    </CartProvider>
  );
}
