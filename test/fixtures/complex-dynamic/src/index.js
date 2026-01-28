export async function load() {
  const mod = await import("./lazy.js");
  return mod.value;
}
