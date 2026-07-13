import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import apply from "../internals/function-apply";
import bind from "../internals/function-bind";
import aConstructor from "../internals/a-constructor";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import create from "../internals/object-create";
import fails from "../internals/fails";
var nativeConstruct = getBuiltIn('Reflect', 'construct');
var ObjectPrototype = Object.prototype;
var push = [].push;

// `Reflect.construct` method
// https://tc39.es/ecma262/#sec-reflect.construct
// MS Edge supports only 2 arguments and argumentsList argument is optional
// FF Nightly sets third argument as `new.target`, but does not create `this` from it
var NEW_TARGET_BUG = fails(function () {
  function F() {/* empty */}
  return !(nativeConstruct(function () {/* empty */}, [], F) instanceof F);
});
var ARGS_BUG = !fails(function () {
  nativeConstruct(function () {/* empty */});
});
var FORCED = NEW_TARGET_BUG || ARGS_BUG;
$({
  target: 'Reflect',
  stat: true,
  forced: FORCED,
  sham: FORCED
}, {
  construct: function construct(Target, args /* , newTarget */) {
    aConstructor(Target);
    var newTarget = arguments.length < 3 ? Target : aConstructor(arguments[2]);
    anObject(args);
    if (ARGS_BUG && !NEW_TARGET_BUG) return nativeConstruct(Target, args, newTarget);
    if (Target === newTarget) {
      // w/o altered newTarget, optimization for 0-4 arguments
      switch (args.length) {
        case 0:
          return new Target();
        case 1:
          return new Target(args[0]);
        case 2:
          return new Target(args[0], args[1]);
        case 3:
          return new Target(args[0], args[1], args[2]);
        case 4:
          return new Target(args[0], args[1], args[2], args[3]);
      }
      // w/o altered newTarget, lot of arguments case
      var $args = [null];
      apply(push, $args, args);
      return new (apply(bind, Target, $args))();
    }
    // with altered newTarget, not support built-in constructors
    var proto = newTarget.prototype;
    var instance = create(isObject(proto) ? proto : ObjectPrototype);
    var result = apply(Target, instance, args);
    return isObject(result) ? result : instance;
  }
});
const _cjs_default = {};
export default _cjs_default;
