import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getBuiltIn from "../internals/get-built-in";
import getMethod from "../internals/get-method";
const _cjs_default = function (iterator, method, argument, reject) {
  try {
    var returnMethod = getMethod(iterator, 'return');
    if (returnMethod) {
      return getBuiltIn('Promise').resolve(call(returnMethod, iterator)).then(function (result) {
        try {
          if (method !== reject) anObject(result);
        } catch (error3) {
          reject(error3);
          return;
        }
        method(argument);
      }, function (error) {
        method === reject ? method(argument) : reject(error);
      });
    }
  } catch (error2) {
    // the original error (`argument`) takes priority over `return()` errors
    return method === reject ? reject(argument) : reject(error2);
  }
  method(argument);
};
export default _cjs_default;
