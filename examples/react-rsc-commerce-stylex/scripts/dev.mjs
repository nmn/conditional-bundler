import { startRscDevServer } from "@bundler/bundler";
import config from "../bundler.config.mjs";

const server = await startRscDevServer({
  config,
  serverEntryId: "server",
  clientEntryId: "client",
  async render(context) {
    const serverModule = await context.loadServerModule();
    await serverModule.handleCommerceRequest({
      request: context.request,
      response: context.response,
      url: context.url,
      clientBundle: context.clientBundle,
    });
  },
});

console.log(`Monarch StyleX dev server running at ${server.url}`);

process.on("SIGINT", () => {
  void server.close().then(() => process.exit(0));
});
