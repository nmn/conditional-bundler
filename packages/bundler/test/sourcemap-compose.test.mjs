import {
  assembleBundle,
  stringifySourceMap,
} from "../dist/sourcemap/compose.js";
import { AnyMap, sourceContentFor } from "@jridgewell/trace-mapping";

const leafMap = {
  version: 3,
  sources: ["source.js"],
  sourcesContent: ["original();"],
  names: [],
  mappings: "AAAA",
};

test("assembles multiline parts and lifts nested indexed sections", () => {
  const nestedMap = {
    version: 3,
    sections: [
      {
        offset: { line: 1, column: 2 },
        map: leafMap,
      },
    ],
  };
  const assembled = assembleBundle([
    { code: "generated header" },
    {
      code: "first line\n  mapped();",
      map: JSON.stringify(nestedMap),
    },
  ]);

  expect(assembled.code).toBe("generated header\nfirst line\n  mapped();");
  expect(assembled.map.sections).toEqual([
    {
      offset: { line: 2, column: 2 },
      map: leafMap,
    },
  ]);
  expect(stringifySourceMap(assembled.map)).not.toContain(
    '"map":{"version":3,"sections"',
  );
});

test("emits shared source content once across cell sections", () => {
  const mapWithoutContent = JSON.stringify({
    ...leafMap,
    sourcesContent: undefined,
  });
  const assembled = assembleBundle([
    {
      code: "first();",
      map: mapWithoutContent,
      sourceContents: { "source.js": "original();" },
    },
    {
      code: "second();",
      map: mapWithoutContent,
      sourceContents: { "source.js": "original();" },
    },
  ]);

  expect(assembled.map.sections[0].map.sourcesContent).toEqual(["original();"]);
  expect(assembled.map.sections[1].map.sourcesContent).toBeUndefined();
  expect(sourceContentFor(new AnyMap(assembled.map), "source.js")).toBe(
    "original();",
  );
});
