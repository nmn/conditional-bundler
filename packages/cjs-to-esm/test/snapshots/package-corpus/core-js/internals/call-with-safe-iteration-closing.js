import anObject from "../internals/an-object";
import iteratorClose from "../internals/iterator-close";
// call something on iterator step with safe closing on error
const _cjs_default = function (iterator, fn, value, ENTRIES) {
  try {
    return ENTRIES ? fn(anObject(value)[0], value[1]) : fn(value);
  } catch (error) {
    iteratorClose(iterator, 'throw', error);
  }
};
export default _cjs_default;
