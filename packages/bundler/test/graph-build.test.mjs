import { buildGraph } from "../dist/graph/build.js";

test("uses portable targets already resolved by the coordinator", async () => {
  const productionTarget = {
    kind: "file",
    moduleId: "project@0.0.0::production.js",
    canonicalPath: "project@0.0.0::production.js",
  };
  const developmentTarget = {
    kind: "file",
    moduleId: "project@0.0.0::development.js",
    canonicalPath: "project@0.0.0::development.js",
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
            target: productionTarget,
            kind: "value",
            condition: "env:NODE_ENV=production",
          },
        ],
        conditionalImports: [
          {
            source: "./production.js",
            request: "./production.js",
            target: productionTarget,
            elseSource: "./development.js",
            elseRequest: "./development.js",
            elseTarget: developmentTarget,
            condition: "env:NODE_ENV=production",
          },
        ],
        exportStars: [],
        reexportsNamed: [],
      },
    ],
  });

  expect(graph.nodes.get("/project/index.js").deps).toEqual([
    "project@0.0.0::production.js",
    "project@0.0.0::development.js",
  ]);
});
