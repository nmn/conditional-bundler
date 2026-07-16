export default function extractTailwindCandidates() {
  const candidates = new Set();
  const collect = (value) => {
    if (typeof value !== "string") return;
    for (const candidate of value.split(/\s+/)) {
      if (candidate) candidates.add(candidate);
    }
  };
  return {
    name: "conditional-bundler-tailwind-candidates",
    visitor: {
      StringLiteral(path) {
        collect(path.node.value);
      },
      TemplateElement(path) {
        collect(path.node.value.cooked ?? path.node.value.raw);
      },
    },
    post(file) {
      if (candidates.size === 0) return;
      const values = Array.from(candidates).sort();
      const outputs =
        file.metadata.conditionalBundlerExtraOutputs ??
        (file.metadata.conditionalBundlerExtraOutputs = {});
      outputs["tailwind-candidates"] = {
        type: "tailwind-candidates",
        contents: JSON.stringify(values),
        metadata: {
          candidates: values,
        },
      };
    },
  };
}
