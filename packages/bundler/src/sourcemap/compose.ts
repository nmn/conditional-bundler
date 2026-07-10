import type { BundlePart } from "../plugins/types.js";

export type SourceMapOffset = {
  line: number;
  column: number;
};

export type RegularSourceMap = {
  version: 3;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: Array<string | null>;
  names: string[];
  mappings: string;
  [key: string]: unknown;
};

export type IndexedSourceMapSection = {
  offset: SourceMapOffset;
  map: SourceMap;
};

export type IndexedSourceMap = {
  version: 3;
  file?: string;
  sections: IndexedSourceMapSection[];
};

export type SourceMap = RegularSourceMap | IndexedSourceMap;

export function assembleBundle(
  parts: BundlePart[],
  file?: string,
): { code: string; map: IndexedSourceMap } {
  const sections: IndexedSourceMapSection[] = [];
  const position: SourceMapOffset = { line: 0, column: 0 };
  let code = "";

  parts.forEach((part, index) => {
    if (index > 0) {
      code += "\n";
      advancePosition(position, "\n");
    }
    if (part.map) {
      appendMapSections(sections, parseSourceMap(part.map), position);
    }
    code += part.code;
    advancePosition(position, part.code);
  });
  assertSectionsOrdered(sections);

  return {
    code,
    map: {
      version: 3,
      ...(file ? { file } : {}),
      sections,
    },
  };
}

export function parseSourceMap(map: string): SourceMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(map);
  } catch (error) {
    throw new Error(`Invalid source map JSON: ${(error as Error).message}`);
  }
  validateSourceMap(parsed);
  return parsed;
}

export function stringifySourceMap(map: SourceMap): string {
  return JSON.stringify(map);
}

function appendMapSections(
  output: IndexedSourceMapSection[],
  map: SourceMap,
  parentOffset: SourceMapOffset,
): void {
  if (!isIndexedSourceMap(map)) {
    output.push({
      offset: { ...parentOffset },
      map,
    });
    return;
  }

  for (const section of map.sections) {
    appendMapSections(
      output,
      section.map,
      combineOffsets(parentOffset, section.offset),
    );
  }
}

function isIndexedSourceMap(map: SourceMap): map is IndexedSourceMap {
  return Array.isArray((map as { sections?: unknown }).sections);
}

function validateSourceMap(value: unknown): asserts value is SourceMap {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 3
  ) {
    throw new Error("Only Source Map v3 maps are supported.");
  }
  if ("sections" in value) {
    if (!Array.isArray(value.sections)) {
      throw new Error("Indexed source map sections must be an array.");
    }
    for (const section of value.sections) {
      if (
        !section ||
        typeof section !== "object" ||
        !("map" in section) ||
        !("offset" in section) ||
        !isValidOffset(section.offset)
      ) {
        throw new Error("Source map URL sections are not supported.");
      }
      validateSourceMap(section.map);
    }
    return;
  }
  const regular = value as Partial<RegularSourceMap>;
  if (
    !Array.isArray(regular.sources) ||
    !Array.isArray(regular.names) ||
    typeof regular.mappings !== "string"
  ) {
    throw new Error("Malformed regular Source Map v3.");
  }
}

function isValidOffset(value: unknown): value is SourceMapOffset {
  if (!value || typeof value !== "object") {
    return false;
  }
  const offset = value as Partial<SourceMapOffset>;
  return (
    Number.isInteger(offset.line) &&
    Number.isInteger(offset.column) &&
    (offset.line ?? -1) >= 0 &&
    (offset.column ?? -1) >= 0
  );
}

function assertSectionsOrdered(sections: IndexedSourceMapSection[]): void {
  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1].offset;
    const current = sections[index].offset;
    if (
      current.line < previous.line ||
      (current.line === previous.line && current.column <= previous.column)
    ) {
      throw new Error("Source map sections must have increasing offsets.");
    }
  }
}

function combineOffsets(
  parent: SourceMapOffset,
  child: SourceMapOffset,
): SourceMapOffset {
  return {
    line: parent.line + child.line,
    column: child.line === 0 ? parent.column + child.column : child.column,
  };
}

function advancePosition(position: SourceMapOffset, code: string): void {
  const lastNewline = code.lastIndexOf("\n");
  if (lastNewline === -1) {
    position.column += code.length;
    return;
  }
  let lineCount = 0;
  for (let index = 0; index < code.length; index += 1) {
    if (code.charCodeAt(index) === 10) {
      lineCount += 1;
    }
  }
  position.line += lineCount;
  position.column = code.length - lastNewline - 1;
}
