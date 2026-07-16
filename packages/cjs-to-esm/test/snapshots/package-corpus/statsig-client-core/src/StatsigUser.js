import Hashing_1 from "./Hashing";
import Log_1 from "./Log";
import SafeJs_1 from "./SafeJs";
export function _normalizeUser(original, options, fallbackEnvironment) {
  const copy = (0, SafeJs_1._cloneObject)('StatsigUser', original);
  if (copy == null) {
    Log_1.Log.error('Failed to clone user');
    return {
      statsigEnvironment: undefined
    };
  }
  if (options != null && options.environment != null) {
    copy.statsigEnvironment = options.environment;
  } else if (fallbackEnvironment != null) {
    copy.statsigEnvironment = {
      tier: fallbackEnvironment
    };
  }
  return copy;
}
export function _getFullUserHash(user) {
  return user ? (0, Hashing_1._DJB2Object)(user) : null;
}
export function _getUnitIDFromUser(user, idType) {
  var _a, _b, _c;
  if (typeof idType !== 'string') {
    return user.userID;
  }
  const lowered = idType.toLowerCase();
  if (lowered !== 'userid') {
    return (_b = (_a = user.customIDs) === null || _a === void 0 ? void 0 : _a[idType]) !== null && _b !== void 0 ? _b : (_c = user.customIDs) === null || _c === void 0 ? void 0 : _c[lowered];
  }
  return user.userID;
}
const _cjs_default = {
  ["_getUnitIDFromUser"]: _getUnitIDFromUser,
  ["_getFullUserHash"]: _getFullUserHash,
  ["_normalizeUser"]: _normalizeUser
};
export default _cjs_default;
