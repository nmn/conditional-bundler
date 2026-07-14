import * as __cjs_dep_0 from "node:fs";
import * as __cjs_dep_1 from "node:os";
import * as __cjs_dep_2 from "node:path";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "fs":
      return __cjs_dep_0;
    case "os":
      return __cjs_dep_1;
    case "path":
      return __cjs_dep_2;
    default:
      throw new Error("Cannot require " + request + " from core-js@3.49.0::postinstall.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("core-js@3.49.0::postinstall.js::env=snapshot::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::postinstall.js::env=snapshot::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    'use strict';

    /* eslint-disable node/no-sync -- avoiding overcomplicating */
    /* eslint-disable unicorn/prefer-node-protocol -- ancient env possible */
    var fs = require('fs');
    var os = require('os');
    var path = require('path');
    var env = process.env;
    var ADBLOCK = is(env.ADBLOCK);
    var COLOR = is(env.npm_config_color);
    var DISABLE_OPENCOLLECTIVE = is(env.DISABLE_OPENCOLLECTIVE);
    var SILENT = ['silent', 'error', 'warn'].indexOf(env.npm_config_loglevel) !== -1;
    var OPEN_SOURCE_CONTRIBUTOR = is(env.OPEN_SOURCE_CONTRIBUTOR);
    var MINUTE = 60 * 1000;

    // you could add a PR with an env variable for your CI detection
    var CI = ['BUILD_NUMBER', 'CI', 'CONTINUOUS_INTEGRATION', 'DRONE', 'RUN_ID'].some(function (it) {
      return is(env[it]);
    });
    var BANNER = '\u001B[96mThank you for using core-js (\u001B[94m https://github.com/zloirock/core-js \u001B[96m) for polyfilling JavaScript standard library!\u001B[0m\n\n' + '\u001B[96mThe project needs your help! Please consider supporting core-js:\u001B[0m\n' + '\u001B[96m>\u001B[94m https://opencollective.com/core-js \u001B[0m\n' + '\u001B[96m>\u001B[94m https://patreon.com/zloirock \u001B[0m\n' + '\u001B[96m>\u001B[94m https://boosty.to/zloirock \u001B[0m\n' + '\u001B[96m>\u001B[94m bitcoin: bc1qlea7544qtsmj2rayg0lthvza9fau63ux0fstcz \u001B[0m\n\n' + '\u001B[96mI highly recommend reading this:\u001B[94m https://github.com/zloirock/core-js/blob/master/docs/2023-02-14-so-whats-next.md \u001B[96m\u001B[0m\n';
    function is(it) {
      return !!it && it !== '0' && it !== 'false';
    }
    function isBannerRequired() {
      if (ADBLOCK || CI || DISABLE_OPENCOLLECTIVE || SILENT || OPEN_SOURCE_CONTRIBUTOR) return false;
      var file = path.join(os.tmpdir(), 'core-js-banners');
      var banners = [];
      try {
        var DELTA = Date.now() - fs.statSync(file).mtime;
        if (DELTA >= 0 && DELTA < MINUTE * 3) {
          banners = JSON.parse(fs.readFileSync(file));
          if (banners.indexOf(BANNER) !== -1) return false;
        }
      } catch (error) {
        banners = [];
      }
      try {
        banners.push(BANNER);
        fs.writeFileSync(file, JSON.stringify(banners), 'utf8');
      } catch (error) {/* empty */}
      return true;
    }
    function showBanner() {
      // eslint-disable-next-line no-console, regexp/no-control-character -- output
      console.log(COLOR ? BANNER : BANNER.replace(/\u001B\[\d+m/g, ''));
    }
    if (isBannerRequired()) showBanner();
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "core-js@3.49.0::postinstall.js", ".");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::postinstall.js::env=snapshot::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
