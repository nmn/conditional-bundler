export type Replacement = {
  start: number;
  end: number;
  text: string;
};

export function applyReplacements(code: string, replacements: Replacement[]): string {
  const sorted = [...replacements].sort((a, b) => b.start - a.start);
  let output = code;
  for (const { start, end, text } of sorted) {
    output = output.slice(0, start) + text + output.slice(end);
  }
  return output;
}
