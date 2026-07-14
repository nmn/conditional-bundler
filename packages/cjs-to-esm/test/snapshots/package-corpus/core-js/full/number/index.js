import __cjs_dep_0 from "../../actual/number";
import __cjs_dep_1 from "../../modules/es.object.to-string";
import __cjs_dep_2 from "../../modules/esnext.number.clamp";
import __cjs_dep_3 from "../../modules/esnext.number.from-string";
import __cjs_dep_4 from "../../modules/esnext.number.range";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "../../actual/number":
      return __cjs_dep_0;
    case "../../modules/es.object.to-string":
      return __cjs_dep_1;
    case "../../modules/esnext.number.clamp":
      return __cjs_dep_2;
    case "../../modules/esnext.number.from-string":
      return __cjs_dep_3;
    case "../../modules/esnext.number.range":
      return __cjs_dep_4;
    default:
      throw new Error("Cannot require " + request + " from core-js@3.49.0::full/number/index.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("core-js@3.49.0::full/number/index.js::env=snapshot::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::full/number/index.js::env=snapshot::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    'use strict';

    var parent = require('../../actual/number');
    module.exports = parent;
    require('../../modules/es.object.to-string');
    require('../../modules/esnext.number.clamp');
    require('../../modules/esnext.number.from-string');
    require('../../modules/esnext.number.range');
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "core-js@3.49.0::full/number/index.js", "core-js@3.49.0::full/number");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::full/number/index.js::env=snapshot::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
