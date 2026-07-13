import DESCRIPTORS from "../internals/descriptors";
import { EXISTS as _EXISTS } from "../internals/function-name";
import uncurryThis from "../internals/function-uncurry-this";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
var FUNCTION_NAME_EXISTS = _EXISTS;
var FunctionPrototype = Function.prototype;
var functionToString = uncurryThis(FunctionPrototype.toString);
var nameRE = /function\b(?:\s|\/\*[\S\s]*?\*\/|\/\/[^\n\r]*[\n\r]+)*([^\s(/]*)/;
var regExpExec = uncurryThis(nameRE.exec);
var NAME = 'name';

// Function instances `.name` property
// https://tc39.es/ecma262/#sec-function-instances-name
if (DESCRIPTORS && !FUNCTION_NAME_EXISTS) {
  defineBuiltInAccessor(FunctionPrototype, NAME, {
    configurable: true,
    get: function () {
      try {
        return regExpExec(nameRE, functionToString(this))[1];
      } catch (error) {
        return '';
      }
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
