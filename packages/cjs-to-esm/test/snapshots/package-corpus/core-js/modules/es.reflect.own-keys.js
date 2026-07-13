import $ from "../internals/export";
import ownKeys from "../internals/own-keys";
// `Reflect.ownKeys` method
// https://tc39.es/ecma262/#sec-reflect.ownkeys
$({
  target: 'Reflect',
  stat: true
}, {
  ownKeys: ownKeys
});
const _cjs_default = {};
export default _cjs_default;
