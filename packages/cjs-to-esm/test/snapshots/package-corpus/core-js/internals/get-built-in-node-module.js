import globalThis from "../internals/global-this";
import IS_NODE from "../internals/environment-is-node";
const _cjs_default = function (name) {
  if (IS_NODE) {
    try {
      return globalThis.process.getBuiltinModule(name);
    } catch (error) {/* empty */}
    try {
      // eslint-disable-next-line no-new-func -- safe
      return Function('return require("' + name + '")')();
    } catch (error) {/* empty */}
  }
};
export default _cjs_default;
