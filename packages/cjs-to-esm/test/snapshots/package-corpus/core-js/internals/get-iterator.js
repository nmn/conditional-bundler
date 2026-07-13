import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import tryToString from "../internals/try-to-string";
import getIteratorMethod from "../internals/get-iterator-method";
var $TypeError = TypeError;
const _cjs_default = function (argument, usingIterator) {
  var iteratorMethod = arguments.length < 2 ? getIteratorMethod(argument) : usingIterator;
  if (aCallable(iteratorMethod)) return anObject(call(iteratorMethod, argument));
  throw new $TypeError(tryToString(argument) + ' is not iterable');
};
export default _cjs_default;
