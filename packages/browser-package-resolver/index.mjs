export default function browserPackageResolver(options = {}) {
  const exportConditions = options.exportConditions ?? [
    "browser",
    "import",
    "default",
  ];
  return {
    name: "browser-package-resolver",
    resolvePackage(context) {
      return context.resolveDefault({
        browserField: options.browserField ?? true,
        exportConditions,
      });
    },
  };
}
