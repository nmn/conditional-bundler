import { AnyMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { defaultFilePath, transform } from "./helpers/transform.mjs";

test("generates a source map for each final worker cell", async () => {
  const result = await transform(
    "export const first = 1;\nexport const second = first + 1;",
    { sourceMap: true },
  );

  expect(result.fileRecord.cells).toHaveLength(2);
  for (const cell of result.fileRecord.cells) {
    expect(cell.map).toEqual(expect.any(String));
  }

  const second = result.fileRecord.cells[1];
  const original = originalPositionFor(new AnyMap(second.map), {
    line: 1,
    column: 0,
  });
  expect(original.source).toBe(defaultFilePath);
  expect(original.line).toBe(2);
});

test("generates one coherent map after adjacent statements are merged", async () => {
  const result = await transform("const value = 1;\nconsole.log(value);", {
    sourceMap: true,
  });
  const [cell] = result.fileRecord.cells;
  const generatedLine = cell.code
    .split("\n")
    .findIndex((line) => line.includes("console.log"));

  expect(result.fileRecord.cells).toHaveLength(1);
  expect(
    originalPositionFor(new AnyMap(cell.map), {
      line: generatedLine + 1,
      column: 0,
    }).line,
  ).toBe(2);
});

test("does not retain an input sourceMappingURL comment", async () => {
  const result = await transform(
    "export const value = 1;\n//# sourceMappingURL=stale.js.map",
    { sourceMap: true },
  );

  expect(result.fileRecord.cells[0].code).not.toContain("sourceMappingURL");
});
