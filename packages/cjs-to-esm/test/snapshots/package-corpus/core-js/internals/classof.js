import TO_STRING_TAG_SUPPORT from "../internals/to-string-tag-support";
import isCallable from "../internals/is-callable";
import classofRaw from "../internals/classof-raw";
import wellKnownSymbol from "../internals/well-known-symbol";
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $Object = Object;

// ES3 wrong here
var CORRECT_ARGUMENTS = classofRaw(function () {
  return arguments;
}()) === 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function (it, key) {
  try {
    return it[key];
  } catch (error) {/* empty */}
};

// getting tag from ES6+ `Object.prototype.toString`
const _cjs_default = TO_STRING_TAG_SUPPORT ? classofRaw : function (it) {
  var O, tag, result;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
  // @@toStringTag case
  : typeof (tag = tryGet(O = $Object(it), TO_STRING_TAG)) == 'string' ? tag
  // builtinTag case
  : CORRECT_ARGUMENTS ? classofRaw(O)
  // ES3 arguments fallback
  : (result = classofRaw(O)) === 'Object' && isCallable(O.callee) ? 'Arguments' : result;
};
export default _cjs_default;
