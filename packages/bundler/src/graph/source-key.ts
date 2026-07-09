export type SourceReference = {
  source: string;
  request?: string;
};

export function sourceLookupKey(reference: SourceReference): string {
  return reference.request ?? reference.source;
}
