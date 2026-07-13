import "../../modules/es.object.define-property";
import path from "../../internals/path";
var Object = path.Object;
const _cjs_default = function defineProperty(it, key, desc) {
  return Object.defineProperty(it, key, desc);
};
if (Object.defineProperty.sham) $defineProperty.sham = true;
export default _cjs_default;
