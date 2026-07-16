import {
  createRscExampleServer,
  handleRscExampleRequest,
} from "@bundler/rsc-example-server";
import App from "./App.jsx";

const options = {
  AppComponent: App,
  title: "Monarch Goods · StyleX",
};

export function createCommerceServer(context = {}) {
  return createRscExampleServer({ ...options, ...context });
}

export function handleCommerceRequest(context = {}) {
  return handleRscExampleRequest({ ...options, ...context });
}

export function disposeCommerceServer() {}

if (!globalThis.__BUNDLER_RSC_DEV__) {
  const server = createCommerceServer();
  const port = Number(process.env.PORT ?? 3300);
  server.listen(port, () => {
    console.log(`Monarch StyleX running at http://localhost:${port}`);
  });
}
