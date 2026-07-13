import { buildGraph } from "../dist/graph/build.js";

test("forwards condition attributes when resolving conditional graph edges", async () => {
  const calls = [];
  const resolver = async (
    _fromId,
    _fromPath,
    request,
    _envId,
    kind,
    importAttributes,
  ) => {
    calls.push({ request, kind, importAttributes });
    const mode = kind === "conditional-else" ? "development" : "production";
    return {
      id: `virtual:cjs:${mode}:${request}`,
      filePath: `/project/${request}`,
      external: false,
      virtual: true,
    };
  };

  const graph = await buildGraph({
    envId: "rsc",
    headers: [
      {
        id: "/project/index.js",
        filePath: "/project/index.js",
        prefix: "entry",
        imports: [
          {
            source: "./production.js",
            request: "./production.js",
            external: false,
            kind: "value",
            condition: "env:NODE_ENV=production",
          },
        ],
        conditionalImports: [
          {
            source: "./production.js",
            request: "./production.js",
            elseSource: "./development.js",
            elseRequest: "./development.js",
            condition: "env:NODE_ENV=production",
          },
        ],
        exportStars: [],
        reexportsNamed: [],
      },
    ],
    resolver,
  });

  expect(calls).toEqual([
    {
      request: "./production.js",
      kind: "conditional-import",
      importAttributes: { condition: "env:NODE_ENV=production" },
    },
    {
      request: "./development.js",
      kind: "conditional-else",
      importAttributes: { condition: "env:NODE_ENV=production" },
    },
  ]);
  expect(graph.nodes.get("/project/index.js").deps).toEqual([
    "virtual:cjs:production:./production.js",
    "virtual:cjs:development:./development.js",
  ]);
});
