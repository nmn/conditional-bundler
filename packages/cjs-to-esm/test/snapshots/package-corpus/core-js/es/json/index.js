import "../../modules/es.object.create";
import "../../modules/es.object.freeze";
import "../../modules/es.object.keys";
import "../../modules/es.date.to-json";
import "../../modules/es.json.is-raw-json";
import "../../modules/es.json.parse";
import "../../modules/es.json.raw-json";
import "../../modules/es.json.stringify";
import "../../modules/es.json.to-string-tag";
import path from "../../internals/path";
// eslint-disable-next-line es/no-json -- safe
const _cjs_default = path.JSON || (path.JSON = {
  stringify: JSON.stringify
});
export default _cjs_default;
