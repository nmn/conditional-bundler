export type SourceReference = {
  source: string;
  request?: string;
  target?: {
    kind: "file" | "runtime";
    moduleId?: string;
  };
};

export function sourceLookupKey(reference: SourceReference): string {
  const request = reference.request ?? reference.source;
  return reference.target?.kind === "file" && reference.target.moduleId
    ? `${request}\0${reference.target.moduleId}`
    : request;
}
