import internalObjectKeys from "../internals/object-keys-internal";
import enumBugKeys from "../internals/enum-bug-keys";
// `Object.keys` method
// https://tc39.es/ecma262/#sec-object.keys
// eslint-disable-next-line es/no-object-keys -- safe
const _cjs_default = Object.keys || function keys(O) {
  return internalObjectKeys(O, enumBugKeys);
};
export default _cjs_default;
