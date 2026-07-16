import React from "react";
import { renderToString } from "react-dom/server";
import { createSpaExampleServer } from "@bundler/spa-example-server";
import { App } from "./App.jsx";
import { loadRoute } from "./router.js";

const server = createSpaExampleServer({
  title: "Greenline Ops · StyleX",
  async render(url) {
    const route = await loadRoute(url.pathname);
    return renderToString(<App routeId={route.id} Route={route.Route} />);
  },
});

const port = Number(process.env.PORT ?? 3500);
server.listen(port, () => {
  console.log(`StyleX SPA running at http://localhost:${port}`);
});
