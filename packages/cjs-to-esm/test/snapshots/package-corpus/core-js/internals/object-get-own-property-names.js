import internalObjectKeys from "../internals/object-keys-internal";
import enumBugKeys from "../internals/enum-bug-keys";
var hiddenKeys = enumBugKeys.concat('length', 'prototype');

// `Object.getOwnPropertyNames` method
// https://tc39.es/ecma262/#sec-object.getownpropertynames
// eslint-disable-next-line es/no-object-getownpropertynames -- safe
const _f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return internalObjectKeys(O, hiddenKeys);
};
export { _f as f };
const _cjs_default = {
  ["f"]: _f
};
export default _cjs_default;
