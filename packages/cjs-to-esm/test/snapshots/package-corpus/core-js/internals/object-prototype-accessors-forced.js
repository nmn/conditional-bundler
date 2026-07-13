import IS_PURE from "../internals/is-pure";
import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import WEBKIT from "../internals/environment-webkit-version";
/* eslint-disable no-undef, no-useless-call, sonarjs/no-reference-error -- required for testing */
/* eslint-disable es/no-legacy-object-prototype-accessor-methods -- required for testing */

// Forced replacement object prototype accessors methods
const _cjs_default = IS_PURE || !fails(function () {
  // This feature detection crashes old WebKit
  // https://github.com/zloirock/core-js/issues/232
  if (WEBKIT && WEBKIT < 535) return;
  var key = Math.random();
  // In FF throws only define methods
  __defineSetter__.call(null, key, function () {/* empty */});
  delete globalThis[key];
});
export default _cjs_default;
