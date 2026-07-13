import $ from "../internals/export";
import { DataView as _DataView } from "../internals/array-buffer";
import NATIVE_ARRAY_BUFFER from "../internals/array-buffer-basic-detection";
// `DataView` constructor
// https://tc39.es/ecma262/#sec-dataview-constructor
$({
  global: true,
  constructor: true,
  forced: !NATIVE_ARRAY_BUFFER
}, {
  DataView: _DataView
});
const _cjs_default = {};
export default _cjs_default;
