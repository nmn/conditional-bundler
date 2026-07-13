import $ from "../internals/export";
import FREEZING from "../internals/freezing";
import fails from "../internals/fails";
import isObject from "../internals/is-object";
import { onFreeze as _onFreeze } from "../internals/internal-metadata";
var onFreeze = _onFreeze;

// eslint-disable-next-line es/no-object-freeze -- safe
var $freeze = Object.freeze;
var FAILS_ON_PRIMITIVES = fails(function () {
  $freeze(1);
});

// `Object.freeze` method
// https://tc39.es/ecma262/#sec-object.freeze
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES,
  sham: !FREEZING
}, {
  freeze: function freeze(it) {
    return $freeze && isObject(it) ? $freeze(onFreeze(it)) : it;
  }
});
const _cjs_default = {};
export default _cjs_default;
