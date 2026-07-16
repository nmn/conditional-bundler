/* global document, window */

import React, { startTransition, use, useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import {
  createFromFetch,
  createFromReadableStream,
} from "react-server-dom-webpack/client.browser";

const rscEndpoint = "__BUNDLER_RSC_ENDPOINT__";

function RscView({ response }) {
  return use(response);
}

function ClientApp({ initialRoute }) {
  const [route, setRoute] = useState(
    () => initialRoute ?? createRouteState(currentPath()),
  );

  useEffect(() => {
    const navigate = (to) => {
      const next = normalizePath(to);
      if (next === currentPath()) return;
      window.history.pushState(null, "", next);
      startTransition(() => setRoute(createRouteState(next)));
    };
    const refresh = (nextPath = currentPath()) => {
      startTransition(() =>
        setRoute(createRouteState(normalizePath(nextPath))),
      );
    };
    const onNavigate = (event) => {
      event.preventDefault();
      navigate(event.detail?.path ?? currentPath());
    };
    const onPopState = () => refresh();
    const onRscRefresh = (event) => {
      event.preventDefault();
      refresh();
    };
    window.addEventListener("bundler:rsc-navigate", onNavigate);
    window.addEventListener("bundler:rsc-refresh", onRscRefresh);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("bundler:rsc-navigate", onNavigate);
      window.removeEventListener("bundler:rsc-refresh", onRscRefresh);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return React.createElement(RscView, { response: route.response });
}

function createRouteState(routePath) {
  return {
    path: routePath,
    response: createFromFetch(
      fetch(`${rscEndpoint}?path=${encodeURIComponent(routePath)}`, {
        headers: { accept: "text/x-component" },
      }),
    ),
  };
}

function readInitialRouteState() {
  const script = document.getElementById("__BUNDLER_RSC_DATA__");
  if (!script) return null;
  const payload = JSON.parse(script.textContent || '""');
  const routePath = normalizePath(script.dataset.path || currentPath());
  script.remove();
  return {
    path: routePath,
    response: createFromReadableStream(createFlightStream(payload)),
  };
}

function installInitialChunkMap() {
  const script = document.getElementById("__BUNDLER_RSC_CHUNKS__");
  if (!script) return;
  const chunks = (globalThis.__BUNDLER_RSC_CHUNKS__ ??= {});
  Object.assign(chunks, JSON.parse(script.textContent || "{}"));
  script.remove();
}

function createFlightStream(payload) {
  const bytes = new TextEncoder().encode(payload);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function currentPath() {
  return normalizePath(window.location.pathname + window.location.search);
}

function normalizePath(routePath) {
  return routePath && routePath.startsWith("/")
    ? routePath
    : `/${routePath || ""}`;
}

if (typeof document !== "undefined") {
  installInitialChunkMap();
  const rootElement = document.getElementById("root");
  const app = React.createElement(ClientApp, {
    initialRoute: readInitialRouteState(),
  });
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, app);
  } else {
    createRoot(rootElement).render(app);
  }
}
