import $ from "../internals/export";
import NATIVE_RAW_JSON from "../internals/native-raw-json";
import isRawJSON from "../internals/is-raw-json";
// `JSON.isRawJSON` method
// https://tc39.es/proposal-json-parse-with-source/#sec-json.israwjson
// https://github.com/tc39/proposal-json-parse-with-source
$({
  target: 'JSON',
  stat: true,
  forced: !NATIVE_RAW_JSON
}, {
  isRawJSON: isRawJSON
});
const _cjs_default = {};
export default _cjs_default;
