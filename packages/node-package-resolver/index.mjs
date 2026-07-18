export default function nodePackageResolver(options = {}) {
  const exportConditions = options.exportConditions ?? [
    "node",
    "import",
    "default",
  ];
  return {
    name: "node-package-resolver",
    resolvePackage(context) {
      return context.resolveDefault({
        browserField: options.browserField ?? false,
        exportConditions,
      });
    },
  };
}
