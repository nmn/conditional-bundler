import isPrototypeOf from "../../internals/object-is-prototype-of";
import numberMethod from "../number/virtual/clamp";
var NumberPrototype = String.prototype;
const _cjs_default = function (it) {
  var ownProperty = it.clamp;
  // eslint-disable-next-line es/no-nonstandard-string-prototype-properties -- safe
  if (typeof it == 'number' || it === NumberPrototype || isPrototypeOf(NumberPrototype, it) && ownProperty === NumberPrototype.clamp) {
    return numberMethod;
  }
  return ownProperty;
};
export default _cjs_default;
