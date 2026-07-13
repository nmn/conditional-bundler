import { PROPER as _PROPER } from "../internals/function-name";
import fails from "../internals/fails";
import whitespaces from "../internals/whitespaces";
var PROPER_FUNCTION_NAME = _PROPER;
var non = '\u200B\u0085\u180E';

// check that a method works with the correct list
// of whitespaces and has a correct name
const _cjs_default = function (METHOD_NAME) {
  return fails(function () {
    return !!whitespaces[METHOD_NAME]() || non[METHOD_NAME]() !== non || PROPER_FUNCTION_NAME && whitespaces[METHOD_NAME].name !== METHOD_NAME;
  });
};
export default _cjs_default;
