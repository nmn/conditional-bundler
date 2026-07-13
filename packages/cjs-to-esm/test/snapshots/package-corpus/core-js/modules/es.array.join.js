import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import IndexedObject from "../internals/indexed-object";
import toIndexedObject from "../internals/to-indexed-object";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
var nativeJoin = uncurryThis([].join);
var ES3_STRINGS = IndexedObject !== Object;
var FORCED = ES3_STRINGS || !arrayMethodIsStrict('join', ',');

// `Array.prototype.join` method
// https://tc39.es/ecma262/#sec-array.prototype.join
$({
  target: 'Array',
  proto: true,
  forced: FORCED
}, {
  join: function join(separator) {
    return nativeJoin(toIndexedObject(this), separator === undefined ? ',' : separator);
  }
});
const _cjs_default = {};
export default _cjs_default;
