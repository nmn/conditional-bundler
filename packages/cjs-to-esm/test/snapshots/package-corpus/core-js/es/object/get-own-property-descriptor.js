import "../../modules/es.object.get-own-property-descriptor";
import path from "../../internals/path";
var Object = path.Object;
const _cjs_default = function getOwnPropertyDescriptor(it, key) {
  return Object.getOwnPropertyDescriptor(it, key);
};
if (Object.getOwnPropertyDescriptor.sham) $getOwnPropertyDescriptor.sham = true;
export default _cjs_default;
