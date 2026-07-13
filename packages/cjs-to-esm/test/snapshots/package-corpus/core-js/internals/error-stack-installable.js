import fails from "../internals/fails";
import createPropertyDescriptor from "../internals/create-property-descriptor";
const _cjs_default = !fails(function () {
  var error = new Error('a');
  if (!('stack' in error)) return true;
  // eslint-disable-next-line es/no-object-defineproperty -- safe
  Object.defineProperty(error, 'stack', createPropertyDescriptor(1, 7));
  return error.stack !== 7;
});
export default _cjs_default;
