import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import apply from "../internals/function-apply";
import fails from "../internals/fails";
import wrapErrorConstructorWithCause from "../internals/wrap-error-constructor-with-cause";
var AGGREGATE_ERROR = 'AggregateError';
var $AggregateError = getBuiltIn(AGGREGATE_ERROR);
var FORCED = !fails(function () {
  return $AggregateError([1]).errors[0] !== 1;
}) && fails(function () {
  return $AggregateError([1], AGGREGATE_ERROR, {
    cause: 7
  }).cause !== 7;
});

// https://tc39.es/ecma262/#sec-aggregate-error
$({
  global: true,
  constructor: true,
  arity: 2,
  forced: FORCED
}, {
  AggregateError: wrapErrorConstructorWithCause(AGGREGATE_ERROR, function (init) {
    // eslint-disable-next-line no-unused-vars -- required for functions `.length`
    return function AggregateError(errors, message) {
      return apply(init, this, arguments);
    };
  }, FORCED, true)
});
const _cjs_default = {};
export default _cjs_default;
