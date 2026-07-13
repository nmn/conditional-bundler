import defineBuiltIn from "../internals/define-built-in";
import errorToString from "../internals/error-to-string";
var ErrorPrototype = Error.prototype;

// `Error.prototype.toString` method fix
// https://tc39.es/ecma262/#sec-error.prototype.tostring
if (ErrorPrototype.toString !== errorToString) {
  defineBuiltIn(ErrorPrototype, 'toString', errorToString);
}
const _cjs_default = {};
export default _cjs_default;
