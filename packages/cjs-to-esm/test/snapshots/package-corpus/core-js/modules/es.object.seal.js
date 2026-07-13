import $ from "../internals/export";
import isObject from "../internals/is-object";
import { onFreeze as _onFreeze } from "../internals/internal-metadata";
import FREEZING from "../internals/freezing";
import fails from "../internals/fails";
var onFreeze = _onFreeze;
// eslint-disable-next-line es/no-object-seal -- safe
var $seal = Object.seal;
var FAILS_ON_PRIMITIVES = fails(function () {
  $seal(1);
});

// `Object.seal` method
// https://tc39.es/ecma262/#sec-object.seal
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES,
  sham: !FREEZING
}, {
  seal: function seal(it) {
    return $seal && isObject(it) ? $seal(onFreeze(it)) : it;
  }
});
const _cjs_default = {};
export default _cjs_default;
