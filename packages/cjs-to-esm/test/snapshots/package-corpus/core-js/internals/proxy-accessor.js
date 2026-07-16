import _cjs_import from "../internals/object-define-property";
var defineProperty = _cjs_import.f;
const _cjs_default = function (Target, Source, key) {
  key in Target || defineProperty(Target, key, {
    configurable: true,
    get: function () {
      return Source[key];
    },
    set: function (it) {
      Source[key] = it;
    }
  });
};
export default _cjs_default;
