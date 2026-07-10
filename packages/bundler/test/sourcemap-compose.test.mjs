import {
  assembleBundle,
  stringifySourceMap,
} from "../dist/sourcemap/compose.js";

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
