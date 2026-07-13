import DESCRIPTORS from "../internals/descriptors";
import hasOwn from "../internals/has-own-property";
var FunctionPrototype = Function.prototype;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getDescriptor = DESCRIPTORS && Object.getOwnPropertyDescriptor;
var EXISTS = hasOwn(FunctionPrototype, 'name');
// additional protection from minified / mangled / dropped function names
var PROPER = EXISTS && function something() {/* empty */}.name === 'something';
var CONFIGURABLE = EXISTS && (!DESCRIPTORS || DESCRIPTORS && getDescriptor(FunctionPrototype, 'name').configurable);
const _cjs_default = {
  EXISTS: EXISTS,
  PROPER: PROPER,
  CONFIGURABLE: CONFIGURABLE
};
const _EXISTS = _cjs_default["EXISTS"];
export { _EXISTS as EXISTS };
const _PROPER = _cjs_default["PROPER"];
export { _PROPER as PROPER };
const _CONFIGURABLE = _cjs_default["CONFIGURABLE"];
export { _CONFIGURABLE as CONFIGURABLE };
export default _cjs_default;
