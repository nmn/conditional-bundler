import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import checkCorrectnessOfIteration from "../internals/check-correctness-of-iteration";
import _cjs_import from "../internals/array-buffer-view-core";
/* eslint-disable no-new, sonarjs/inconsistent-function-call -- required for testing */

var NATIVE_ARRAY_BUFFER_VIEWS = _cjs_import.NATIVE_ARRAY_BUFFER_VIEWS;
var ArrayBuffer = globalThis.ArrayBuffer;
var Int8Array = globalThis.Int8Array;
const _cjs_default = !NATIVE_ARRAY_BUFFER_VIEWS || !fails(function () {
  Int8Array(1);
}) || !fails(function () {
  new Int8Array(-1);
}) || !checkCorrectnessOfIteration(function (iterable) {
  new Int8Array();
  new Int8Array(null);
  new Int8Array(1.5);
  new Int8Array(iterable);
}, true) || fails(function () {
  // Safari (11+) bug - a reason why even Safari 13 should load a typed array polyfill
  return new Int8Array(new ArrayBuffer(2), 1, undefined).length !== 1;
});
export default _cjs_default;
