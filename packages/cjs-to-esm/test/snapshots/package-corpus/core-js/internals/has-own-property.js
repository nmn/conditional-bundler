import uncurryThis from "../internals/function-uncurry-this";
import toObject from "../internals/to-object";
var hasOwnProperty = uncurryThis({}.hasOwnProperty);

// `HasOwnProperty` abstract operation
// https://tc39.es/ecma262/#sec-hasownproperty
// eslint-disable-next-line es/no-object-hasown -- safe
const _cjs_default = Object.hasOwn || function hasOwn(it, key) {
  return hasOwnProperty(toObject(it), key);
};
export default _cjs_default;
