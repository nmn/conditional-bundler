const productColors = {
  "copper-kettle": "bg-[#b87333]",
  "stoneware-set": "bg-[#61746a]",
  "market-tote": "bg-[#d7b56d]",
  "espresso-sampler": "bg-[#5a3a2e]",
  "preserved-citrus": "bg-[#e0a72e]",
  "linen-runner": "bg-[#a8b1a0]",
  "breakfast-club": "bg-[#db6b42]",
  "maple-granola": "bg-[#b8803d]",
};

export function productColorClass(id) {
  return productColors[id] ?? "bg-[#b87333]";
}

export function classes(...values) {
  return values.filter(Boolean).join(" ");
}
