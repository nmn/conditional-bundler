export function stripImportStatements(code: string, ranges: Array<[number, number]>): string {
  const sorted = [...ranges].sort((a, b) => b[0] - a[0]);
  let output = code;
  for (const [start, end] of sorted) {
    output = output.slice(0, start) + output.slice(end);
  }
  return output;
}
