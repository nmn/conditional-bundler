import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import create from "../internals/object-create";
// TODO: Remove from `core-js@4`

// `Object.create` method
// https://tc39.es/ecma262/#sec-object.create
$({
  target: 'Object',
  stat: true,
  sham: !DESCRIPTORS
}, {
  create: create
});
const _cjs_default = {};
export default _cjs_default;
