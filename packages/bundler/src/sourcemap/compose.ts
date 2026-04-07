export function composeSourceMaps(
  maps: Array<string | undefined | null>,
): string | undefined {
  for (let index = maps.length - 1; index >= 0; index -= 1) {
    const candidate = maps[index];
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}
