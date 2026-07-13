import globalThis from "../internals/global-this";
import isObject from "../internals/is-object";
var document = globalThis.document;
// typeof document.createElement is 'object' in old IE
var EXISTS = isObject(document) && isObject(document.createElement);
const _cjs_default = function (it) {
  return EXISTS ? document.createElement(it) : {};
};
export default _cjs_default;
