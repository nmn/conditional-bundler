export default function jsonTransformPlugin(_api, options = {}) {
  return {
    name: "json-plugin",
    parserOverride(code, parserOptions, parse) {
      if (!isJsonFile(options.filePath)) {
        return undefined;
      }

      try {
        JSON.parse(code);
      } catch (error) {
        const identity =
          options.moduleIdentity ?? options.filePath ?? "JSON module";
        const message = error instanceof Error ? error.message : String(error);
        throw new SyntaxError(`Invalid JSON in '${identity}': ${message}`, {
          cause: error,
        });
      }

      return parse(
        `export default JSON.parse(${JSON.stringify(code)});`,
        parserOptions,
      );
    },
  };
}

function isJsonFile(filePath) {
  return (
    typeof filePath === "string" && filePath.toLowerCase().endsWith(".json")
  );
}
