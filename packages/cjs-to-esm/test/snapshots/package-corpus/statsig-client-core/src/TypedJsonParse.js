import Log_1 from "./Log";
/**
 *
 * @param {string} data The values to parse into T
 * @param {string} guard A field that must exists on the parsed object for the parse to be valid
 * @param {string} error An error to print via Log.error() when parsing fails
 * @returns {T | null} The parse object T or null if it failed
 */
export function _typedJsonParse(data, guard, typeName) {
  try {
    const result = JSON.parse(data);
    if (result && typeof result === 'object' && guard in result) {
      return result;
    }
  } catch (_a) {
    // noop
  }
  Log_1.Log.error(`Failed to parse ${typeName}`);
  return null;
}
const _cjs_default = {
  ["_typedJsonParse"]: _typedJsonParse
};
export default _cjs_default;
