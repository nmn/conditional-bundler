import hasOwn from "../internals/has-own-property";
const _cjs_default = function (descriptor) {
  return descriptor !== undefined && (hasOwn(descriptor, 'value') || hasOwn(descriptor, 'writable'));
};
export default _cjs_default;
