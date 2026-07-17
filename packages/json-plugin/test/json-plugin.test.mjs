import { transformAsync } from "@babel/core";
import jsonTransform from "../transform.mjs";

async function transform(code, filePath = "/project/src/data.json") {
  return transformAsync(code, {
    filename: filePath,
    sourceType: "module",
    plugins: [
      [
        jsonTransform,
        {
          filePath,
          moduleIdentity: "example@1.0.0::src/data.json",
        },
      ],
    ],
  });
}

test("emits one default export for any valid JSON value", async () => {
  const source = '{"__proto__":{"safe":true},"offset":-0,"items":[1,null]}';
  const result = await transform(source);
  const value = JSON.parse(source);

  expect(result.code).toBe(
    `export default JSON.parse(${JSON.stringify(source)});`,
  );
  expect(Object.prototype.hasOwnProperty.call(value, "__proto__")).toBe(true);
  expect(Object.is(value.offset, -0)).toBe(true);
});

test("declines non-JSON files", async () => {
  const result = await transform(
    "export const value = 1;",
    "/project/index.js",
  );
  expect(result.code).toBe("export const value = 1;");
});

test("reports invalid JSON with the portable module identity", async () => {
  await expect(transform('{"broken":}')).rejects.toThrow(
    "Invalid JSON in 'example@1.0.0::src/data.json'",
  );
});
