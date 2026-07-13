import $ from "../internals/export";
import $isExtensible from "../internals/object-is-extensible";
// `Object.isExtensible` method
// https://tc39.es/ecma262/#sec-object.isextensible
// eslint-disable-next-line es/no-object-isextensible -- safe
$({
  target: 'Object',
  stat: true,
  forced: Object.isExtensible !== $isExtensible
}, {
  isExtensible: $isExtensible
});
const _cjs_default = {};
export default _cjs_default;
