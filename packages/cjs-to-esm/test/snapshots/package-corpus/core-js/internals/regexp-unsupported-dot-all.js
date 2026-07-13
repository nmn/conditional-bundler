import fails from "../internals/fails";
import globalThis from "../internals/global-this";
// babel-minify and Closure Compiler transpiles RegExp('.', 's') -> /./s and it causes SyntaxError
var $RegExp = globalThis.RegExp;
const _cjs_default = fails(function () {
  var re = $RegExp('.', 's');
  return !(re.dotAll && re.test('\n') && re.flags === 's');
});
export default _cjs_default;
