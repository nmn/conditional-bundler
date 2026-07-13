import { f as _f } from "../internals/object-define-property";
var defineProperty = _f;
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
