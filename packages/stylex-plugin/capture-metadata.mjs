export default function captureStyleXMetadata() {
  return {
    name: "conditional-bundler-stylex-metadata",
    post(file) {
      const rules = file.metadata.stylex;
      if (!Array.isArray(rules) || rules.length === 0) {
        return;
      }
      const outputs =
        file.metadata.conditionalBundlerExtraOutputs ??
        (file.metadata.conditionalBundlerExtraOutputs = {});
      outputs["stylex-rules"] = {
        type: "stylex-json",
        contents: JSON.stringify(rules),
        metadata: {
          rules,
        },
      };
    },
  };
}
