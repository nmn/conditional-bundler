import requireObjectCoercible from "../internals/require-object-coercible";
var $Object = Object;

// `ToObject` abstract operation
// https://tc39.es/ecma262/#sec-toobject
const _cjs_default = function (argument) {
  return $Object(requireObjectCoercible(argument));
};
export default _cjs_default;
