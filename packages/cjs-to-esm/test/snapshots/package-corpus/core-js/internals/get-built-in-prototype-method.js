import globalThis from "../internals/global-this";
const _cjs_default = function (CONSTRUCTOR, METHOD) {
  var Constructor = globalThis[CONSTRUCTOR];
  var Prototype = Constructor && Constructor.prototype;
  return Prototype && Prototype[METHOD];
};
export default _cjs_default;
