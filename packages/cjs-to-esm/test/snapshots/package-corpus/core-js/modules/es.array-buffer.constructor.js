import $ from "../internals/export";
import globalThis from "../internals/global-this";
import arrayBufferModule from "../internals/array-buffer";
import setSpecies from "../internals/set-species";
var ARRAY_BUFFER = 'ArrayBuffer';
var ArrayBuffer = arrayBufferModule[ARRAY_BUFFER];
var NativeArrayBuffer = globalThis[ARRAY_BUFFER];

// `ArrayBuffer` constructor
// https://tc39.es/ecma262/#sec-arraybuffer-constructor
$({
  global: true,
  constructor: true,
  forced: NativeArrayBuffer !== ArrayBuffer
}, {
  ArrayBuffer: ArrayBuffer
});
setSpecies(ARRAY_BUFFER);
const _cjs_default = {};
export default _cjs_default;
