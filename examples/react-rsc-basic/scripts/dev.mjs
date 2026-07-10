import { startRscDevServer } from "@bundler/bundler";
import config from "../bundler.config.mjs";

process.env.NODE_ENV ??= "development";

const server = await startRscDevServer({
  config,
  serverEntryId: "server",
  clientEntryId: "client",
  async render(context) {
    const serverModule = await context.loadServerModule();
    const handleBasicRequest = serverModule.handleBasicRequest;
    if (typeof handleBasicRequest !== "function") {
      throw new Error(
        "Basic RSC server bundle does not export handleBasicRequest.",
      );
    }
    await handleBasicRequest({
      request: context.request,
      response: context.response,
      url: context.url,
      clientBundle: context.clientBundle,
    });
  },
});

console.log(`Basic RSC dev server running at ${server.url}`);

process.on("SIGINT", () => {
  void server.close().then(() => process.exit(0));
});
