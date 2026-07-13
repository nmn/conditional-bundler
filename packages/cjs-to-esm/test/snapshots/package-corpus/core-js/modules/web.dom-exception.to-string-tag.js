import getBuiltIn from "../internals/get-built-in";
import setToStringTag from "../internals/set-to-string-tag";
var DOM_EXCEPTION = 'DOMException';

// `DOMException.prototype[@@toStringTag]` property
setToStringTag(getBuiltIn(DOM_EXCEPTION), DOM_EXCEPTION);
const _cjs_default = {};
export default _cjs_default;
