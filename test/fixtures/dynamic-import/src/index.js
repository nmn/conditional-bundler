export async function loadFoo() {
  const mod = await import("./foo.js");
  return mod.foo;
}
