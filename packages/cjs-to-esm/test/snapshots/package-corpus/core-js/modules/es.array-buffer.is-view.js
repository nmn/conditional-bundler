import $ from "../internals/export";
import { NATIVE_ARRAY_BUFFER_VIEWS as _NATIVE_ARRAY_BUFFER_VIEWS, isView as _isView } from "../internals/array-buffer-view-core";
var NATIVE_ARRAY_BUFFER_VIEWS = _NATIVE_ARRAY_BUFFER_VIEWS;

// `ArrayBuffer.isView` method
// https://tc39.es/ecma262/#sec-arraybuffer.isview
$({
  target: 'ArrayBuffer',
  stat: true,
  forced: !NATIVE_ARRAY_BUFFER_VIEWS
}, {
  isView: _isView
});
const _cjs_default = {};
export default _cjs_default;
