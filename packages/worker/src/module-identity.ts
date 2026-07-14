const CJS_VIRTUAL_PREFIX = "virtual:cjs-to-esm:";

/** Physical CJS wrappers use their package-relative path for symbol prefixes. */
export function modulePrefixIdentity(
  moduleId: string | null | undefined,
  packageRelativePath: string,
): string {
  if (
    moduleId?.startsWith("virtual:") &&
    !moduleId.startsWith(CJS_VIRTUAL_PREFIX)
  ) {
    return moduleId;
  }
  return packageRelativePath;
}
