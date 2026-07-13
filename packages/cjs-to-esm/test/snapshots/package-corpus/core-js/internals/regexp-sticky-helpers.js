import fails from "../internals/fails";
import globalThis from "../internals/global-this";
// babel-minify and Closure Compiler transpiles RegExp('a', 'y') -> /a/y and it causes SyntaxError
var $RegExp = globalThis.RegExp;
var UNSUPPORTED_Y = fails(function () {
  var re = $RegExp('a', 'y');
  re.lastIndex = 2;
  return re.exec('abcd') !== null;
});

// UC Browser bug
// https://github.com/zloirock/core-js/issues/1008
var MISSED_STICKY = UNSUPPORTED_Y || fails(function () {
  return !$RegExp('a', 'y').sticky;
});
var BROKEN_CARET = UNSUPPORTED_Y || fails(function () {
  // https://bugzilla.mozilla.org/show_bug.cgi?id=773687
  var re = $RegExp('^r', 'gy');
  re.lastIndex = 2;
  return re.exec('str') !== null;
});
const _cjs_default = {
  BROKEN_CARET: BROKEN_CARET,
  MISSED_STICKY: MISSED_STICKY,
  UNSUPPORTED_Y: UNSUPPORTED_Y
};
const _BROKEN_CARET = _cjs_default["BROKEN_CARET"];
export { _BROKEN_CARET as BROKEN_CARET };
const _MISSED_STICKY = _cjs_default["MISSED_STICKY"];
export { _MISSED_STICKY as MISSED_STICKY };
const _UNSUPPORTED_Y = _cjs_default["UNSUPPORTED_Y"];
export { _UNSUPPORTED_Y as UNSUPPORTED_Y };
export default _cjs_default;
