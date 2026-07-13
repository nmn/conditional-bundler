import isObject from "../internals/is-object";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
// `InstallErrorCause` abstract operation
// https://tc39.es/ecma262/#sec-installerrorcause
const _cjs_default = function (O, options) {
  if (isObject(options) && 'cause' in options) {
    createNonEnumerableProperty(O, 'cause', options.cause);
  }
};
export default _cjs_default;
