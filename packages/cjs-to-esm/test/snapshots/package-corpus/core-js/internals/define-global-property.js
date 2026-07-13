import globalThis from "../internals/global-this";
// eslint-disable-next-line es/no-object-defineproperty -- safe
var defineProperty = Object.defineProperty;
const _cjs_default = function (key, value) {
  try {
    defineProperty(globalThis, key, {
      value: value,
      configurable: true,
      writable: true
    });
  } catch (error) {
    globalThis[key] = value;
  }
  return value;
};
export default _cjs_default;
