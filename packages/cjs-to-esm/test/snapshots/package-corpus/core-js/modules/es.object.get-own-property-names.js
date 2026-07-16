import $ from "../internals/export";
import fails from "../internals/fails";
import _cjs_import from "../internals/object-get-own-property-names-external";
var getOwnPropertyNames = _cjs_import.f;

// eslint-disable-next-line es/no-object-getownpropertynames -- required for testing
var FAILS_ON_PRIMITIVES = fails(function () {
  return !Object.getOwnPropertyNames(1);
});

// `Object.getOwnPropertyNames` method
// https://tc39.es/ecma262/#sec-object.getownpropertynames
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES
}, {
  getOwnPropertyNames: getOwnPropertyNames
});
const _cjs_default = {};
export default _cjs_default;
