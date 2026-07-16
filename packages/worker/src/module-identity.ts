export function modulePrefixIdentity(
  moduleId: string | null | undefined,
  packageRelativePath: string,
): string {
  const separator = moduleId?.indexOf("::") ?? -1;
  if (moduleId && separator >= 0) {
    return moduleId.slice(separator + 2);
  }
  return packageRelativePath;
}
