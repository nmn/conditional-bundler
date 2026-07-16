import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { loadRoute } from "./router.js";

let root;

async function render(pathname, hydrate = false) {
  const route = await loadRoute(pathname);
  const element = <App routeId={route.id} Route={route.Route} />;
  const container = document.getElementById("root");
  if (hydrate && container.hasChildNodes()) {
    root = hydrateRoot(container, element);
  } else {
    root ??= createRoot(container);
    root.render(element);
  }
}

document.addEventListener("click", (event) => {
  const anchor = event.target.closest("a[href]");
  if (!anchor || anchor.origin !== window.location.origin) return;
  event.preventDefault();
  history.pushState(null, "", anchor.pathname);
  void render(anchor.pathname);
});
window.addEventListener("popstate", () => {
  void render(window.location.pathname);
});

void render(window.location.pathname, true);
