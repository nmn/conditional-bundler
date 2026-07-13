import "../../modules/es.json.to-string-tag";
import "../../modules/es.math.to-string-tag";
import "../../modules/es.object.to-string";
import "../../modules/es.reflect.to-string-tag";
import classof from "../../internals/classof";
const _cjs_default = function (it) {
  return '[object ' + classof(it) + ']';
};
export default _cjs_default;
