import { startRscDevServer } from "@bundler/bundler";
import config from "../bundler.config.mjs";

process.env.NODE_ENV ??= "development";

const server = await startRscDevServer({
  config,
  serverEntryId: "server",
  clientEntryId: "client",
  async render(context) {
    const serverModule = await context.loadServerModule();
    const handleCommerceRequest = serverModule.handleCommerceRequest;
    if (typeof handleCommerceRequest !== "function") {
      throw new Error(
        "Commerce server bundle does not export handleCommerceRequest.",
      );
    }
    await handleCommerceRequest({
      request: context.request,
      response: context.response,
      url: context.url,
      clientBundle: context.clientBundle,
    });
  },
});

console.log(`Monarch Goods dev server running at ${server.url}`);

process.on("SIGINT", () => {
  void server.close().then(() => process.exit(0));
});
