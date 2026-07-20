import {
  createClientImplementation,
  resolveModuleExportName,
} from "../implementation-registry.js";

test("maps RSC export names to the globally unique chunk bindings", () => {
  const chunks = ["/component.js", "/shared.js"];
  Object.defineProperty(chunks, "__bundlerModulePrefix", {
    value: "module123",
  });

  expect(resolveModuleExportName(chunks, "Component")).toBe(
    "module123_Component",
  );
  expect(resolveModuleExportName(chunks, "default")).toBe("module123_default");
  expect(resolveModuleExportName(chunks, "")).toBe("module123_default");
  expect(resolveModuleExportName(chunks, "*")).toBe("*");
  expect(createClientImplementation(chunks, "Component")).toEqual({
    chunks: ["/component.js", "/shared.js"],
    exportName: "Component",
    moduleExportName: "module123_Component",
  });
});

test("preserves export names for legacy chunk arrays without prefix metadata", () => {
  expect(resolveModuleExportName(["/component.js"], "Component")).toBe(
    "Component",
  );
});

test("preserves configured entrypoint export names", () => {
  const chunks = ["/entry.js"];
  Object.defineProperties(chunks, {
    __bundlerModulePrefix: { value: "module123" },
    __bundlerEntryExports: { value: true },
  });
  expect(resolveModuleExportName(chunks, "Component")).toBe("Component");
});
