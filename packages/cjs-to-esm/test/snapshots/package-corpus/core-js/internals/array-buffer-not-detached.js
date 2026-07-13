import isDetached from "../internals/array-buffer-is-detached";
var $TypeError = TypeError;
const _cjs_default = function (it) {
  if (isDetached(it)) throw new $TypeError('ArrayBuffer is detached');
  return it;
};
export default _cjs_default;
