const _MemoPrefix = {
  _gate: 'g',
  _dynamicConfig: 'c',
  _experiment: 'e',
  _configList: 'cl',
  _layer: 'l',
  _paramStore: 'p'
};
export { _MemoPrefix as MemoPrefix };
const EXIST_KEYS = new Set([
  // Add keys that should be memoized based only on their existence, not their value
]);
const DO_NOT_MEMO_KEYS = new Set([
// Add keys that if exist, should not be memoized
'userPersistedValues']);
export function createMemoKey(prefix, name, options) {
  let cacheKey = `${prefix}|${name}`;
  if (!options) {
    return cacheKey;
  }
  for (const key of Object.keys(options)) {
    if (DO_NOT_MEMO_KEYS.has(key)) {
      return undefined;
    }
    if (EXIST_KEYS.has(key)) {
      cacheKey += `|${key}=true`;
    } else {
      cacheKey += `|${key}=${options[key]}`;
    }
  }
  return cacheKey;
}
const _cjs_default = {
  ["createMemoKey"]: createMemoKey,
  ["MemoPrefix"]: _MemoPrefix
};
export default _cjs_default;
