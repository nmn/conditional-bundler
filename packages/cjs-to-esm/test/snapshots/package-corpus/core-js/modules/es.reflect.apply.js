import $ from "../internals/export";
import functionApply from "../internals/function-apply";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import fails from "../internals/fails";
// MS Edge argumentsList argument is optional
var OPTIONAL_ARGUMENTS_LIST = !fails(function () {
  // eslint-disable-next-line es/no-reflect -- required for testing
  Reflect.apply(function () {/* empty */});
});

// `Reflect.apply` method
// https://tc39.es/ecma262/#sec-reflect.apply
$({
  target: 'Reflect',
  stat: true,
  forced: OPTIONAL_ARGUMENTS_LIST
}, {
  apply: function apply(target, thisArgument, argumentsList) {
    return functionApply(aCallable(target), thisArgument, anObject(argumentsList));
  }
});
const _cjs_default = {};
export default _cjs_default;
