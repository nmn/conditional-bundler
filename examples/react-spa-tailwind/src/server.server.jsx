import React from "react";
import { renderToString } from "react-dom/server";
import { createSpaExampleServer } from "@bundler/spa-example-server";
import { App } from "./App.jsx";
import { loadRoute } from "./router.js";

const server = createSpaExampleServer({
  title: "Signal House · Tailwind",
  async render(url) {
    const route = await loadRoute(url.pathname);
    return renderToString(<App routeId={route.id} Route={route.Route} />);
  },
});

const port = Number(process.env.PORT ?? 3600);
server.listen(port, () => {
  console.log(`Tailwind SPA running at http://localhost:${port}`);
});
