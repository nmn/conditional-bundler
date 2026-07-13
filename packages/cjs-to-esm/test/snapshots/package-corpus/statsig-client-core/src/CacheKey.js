import { _DJB2 as _DJB } from "./Hashing";
export function _getUserStorageKey(sdkKey, user, customKeyGenerator) {
  var _a;
  if (customKeyGenerator) {
    return customKeyGenerator(sdkKey, user);
  }
  const cids = user && user.customIDs ? user.customIDs : {};
  const parts = [`uid:${(_a = user === null || user === void 0 ? void 0 : user.userID) !== null && _a !== void 0 ? _a : ''}`, `cids:${Object.keys(cids).sort((leftKey, rightKey) => leftKey.localeCompare(rightKey)).map(key => `${key}-${cids[key]}`).join(',')}`, `k:${sdkKey}`];
  return (0, _DJB)(parts.join('|'));
}
export function _getStorageKey(sdkKey, user, customKeyGenerator) {
  if (user) {
    return _getUserStorageKey(sdkKey, user, customKeyGenerator);
  }
  return (0, _DJB)(`k:${sdkKey}`);
}
const _cjs_default = {
  ["_getStorageKey"]: _getStorageKey,
  ["_getUserStorageKey"]: _getUserStorageKey
};
export default _cjs_default;
