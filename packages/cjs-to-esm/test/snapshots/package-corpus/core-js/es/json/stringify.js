import "../../modules/es.date.to-json";
import "../../modules/es.json.stringify";
import path from "../../internals/path";
import apply from "../../internals/function-apply";
// eslint-disable-next-line es/no-json -- safe
if (!path.JSON) path.JSON = {
  stringify: JSON.stringify
};

// eslint-disable-next-line no-unused-vars -- required for `.length`
const _cjs_default = function stringify(it, replacer, space) {
  return apply(path.JSON.stringify, null, arguments);
};
export default _cjs_default;
