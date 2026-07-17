import { transformAsync } from "@babel/core";
import typescriptTransform from "../transform.mjs";

async function transform(code, filePath) {
  const syntax = {
    jsx: filePath.endsWith(".tsx"),
    ts: filePath.endsWith(".ts") || filePath.endsWith(".tsx"),
  };
  return transformAsync(code, {
    filename: filePath,
    sourceType: "module",
    plugins: [[typescriptTransform, { filePath, syntax }]],
  });
}

test("removes TypeScript syntax from .ts files", async () => {
  const result = await transform(
    `interface User { name: string }
const user: User = { name: "Ada" };
export const greeting: string = user.name;`,
    "/project/src/index.ts",
  );

  expect(result.code).toBe(
    `const user = {
  name: "Ada"
};
export const greeting = user.name;`,
  );
});

test("removes types while preserving JSX in .tsx files", async () => {
  const result = await transform(
    `type Props = { label: string };
export const Badge = ({ label }: Props) => <strong>{label}</strong>;`,
    "/project/src/Badge.tsx",
  );

  expect(result.code).toBe(
    `export const Badge = ({
  label
}) => <strong>{label}</strong>;`,
  );
});

test("declines JavaScript files", async () => {
  const result = await transform(
    "export const value = 1;",
    "/project/src/index.js",
  );
  expect(result.code).toBe("export const value = 1;");
});
