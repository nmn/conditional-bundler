import { transformAsset } from "../dist/transform/asset.js";
import { analyzeCss, finalizeCssTransform } from "../dist/transform/css.js";

const canonicalPath = "portable-fixture@1.0.0::src/styles.css";

function cssInput(root) {
  return Object.freeze({
    id: `${root}/src/styles.css`,
    moduleIdentity: canonicalPath,
    canonicalPath,
    realPath: `${root}/src/styles.css`,
    code: `.before { color: red; }
@import "./theme.css" layer(theme) supports(display: grid) screen;
.after { background: url("./mark.svg"); }`,
    pkg: { name: "portable-fixture", version: "1.0.0", root },
    envs: ["browser"],
    envId: "browser",
    target: "browser",
    buildMode: "development",
  });
}

function cssResolutions() {
  const theme = "portable-fixture@1.0.0::src/theme.css";
  const asset = "portable-fixture@1.0.0::src/mark.svg";
  return Object.freeze({
    "css-import:./theme.css": {
      target: { kind: "file", moduleId: theme, canonicalPath: theme },
      type: "css",
      intent: "module",
    },
    "css-url:./mark.svg": {
      target: {
        kind: "file",
        moduleId: `${asset}::intent=assetPath`,
        canonicalPath: asset,
      },
      type: "asset",
      intent: "assetPath",
      meta: { assetId: asset },
    },
  });
}

test("CSS analysis and transformation are deterministic and portable", () => {
  const firstInput = cssInput("/checkout/one");
  const secondInput = cssInput("/different/machine/checkout/two");
  const firstAnalysis = analyzeCss(firstInput);
  const secondAnalysis = analyzeCss(secondInput);
  const first = finalizeCssTransform(
    firstInput,
    firstAnalysis,
    cssResolutions(),
  );
  const repeated = finalizeCssTransform(
    firstInput,
    analyzeCss(firstInput),
    cssResolutions(),
  );
  const relocated = finalizeCssTransform(
    secondInput,
    secondAnalysis,
    cssResolutions(),
  );

  expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
  expect(JSON.stringify(first)).toBe(JSON.stringify(relocated));
  const metadata = first.fileRecord.extraOutputs["bundler-css"].metadata;
  expect(metadata.cells).toHaveLength(2);
  expect(metadata.cells[1].orderedDeps.map((item) => item.kind)).toEqual([
    "cell",
    "import",
  ]);
  expect(first.fileRecord.linkReferences).toEqual([
    expect.objectContaining({ usage: "css-variable" }),
  ]);
});

test("CSS module names use development and production contracts", () => {
  const base = {
    ...cssInput("/checkout/one"),
    canonicalPath: "portable-fixture@1.0.0::src/card.module.css",
    moduleIdentity: "portable-fixture@1.0.0::src/card.module.css",
    realPath: "/checkout/one/src/card.module.css",
    id: "/checkout/one/src/card.module.css",
    code: ".primary { color: red; }",
  };
  const development = analyzeCss({ ...base, buildMode: "development" });
  const production = analyzeCss({ ...base, buildMode: "production" });
  expect(development.classes.primary).toMatch(/^[a-z0-9]+_primary$/);
  expect(production.classes.primary).toMatch(/^[a-z][a-z0-9]{7}$/);

  const transformed = finalizeCssTransform(
    { ...base, buildMode: "production" },
    production,
    {},
  );
  expect(
    transformed.fileRecord.cells.every((cell) =>
      cell.resourceDeps?.includes(
        transformed.fileRecord.extraOutputs["bundler-css"].metadata.rootCellId,
      ),
    ),
  ).toBe(true);
});

test("asset transforms are deterministic, portable, and intent-specific", () => {
  const bytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="7"></svg>',
  );
  const makeInput = (root, intent) =>
    Object.freeze({
      id: `${root}/src/mark.svg`,
      moduleIdentity: `portable-fixture@1.0.0::src/mark.svg::intent=${intent}`,
      canonicalPath: "portable-fixture@1.0.0::src/mark.svg",
      realPath: `${root}/src/mark.svg`,
      bytes,
      intent,
      assetId: "portable-fixture@1.0.0::src/mark.svg",
      pkg: { name: "portable-fixture", version: "1.0.0", root },
      envs: ["browser"],
      envId: "browser",
    });

  const first = transformAsset(makeInput("/checkout/one", "url"));
  const relocated = transformAsset(
    makeInput("/different/machine/checkout/two", "url"),
  );
  expect(JSON.stringify(first)).toBe(JSON.stringify(relocated));
  const descriptorCode = first.fileRecord.cells
    .map((cell) => cell.code ?? "")
    .join("\n");
  expect(descriptorCode).toContain("width: 12");
  expect(descriptorCode).toContain("height: 7");
  expect(first.fileRecord.extraOutputs["bundler-asset"].metadata.copy).toBe(
    true,
  );

  const raw = transformAsset(makeInput("/checkout/one", "raw"));
  const base64 = transformAsset(makeInput("/checkout/one", "base64"));
  expect(raw.fileRecord.extraOutputs).toBeUndefined();
  expect(base64.fileRecord.extraOutputs).toBeUndefined();
  expect(raw.fileRecord.cells[0].code).toContain(
    JSON.stringify(bytes.toString("utf8")),
  );
  expect(base64.fileRecord.cells[0].code).toContain(
    JSON.stringify(bytes.toString("base64")),
  );
});

test("raw assets reject invalid UTF-8", () => {
  const bytes = Uint8Array.from([0xff, 0xfe]);
  expect(() =>
    transformAsset({
      id: "/checkout/src/data.bin",
      moduleIdentity: "portable-fixture@1.0.0::src/data.bin::intent=raw",
      canonicalPath: "portable-fixture@1.0.0::src/data.bin",
      realPath: "/checkout/src/data.bin",
      bytes,
      intent: "raw",
      assetId: "portable-fixture@1.0.0::src/data.bin",
      pkg: { name: "portable-fixture", version: "1.0.0", root: "/checkout" },
      envs: ["browser"],
      envId: "browser",
    }),
  ).toThrow("not valid UTF-8");
});
