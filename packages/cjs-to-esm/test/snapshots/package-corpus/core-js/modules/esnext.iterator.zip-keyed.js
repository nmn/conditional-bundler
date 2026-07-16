import $ from "../internals/export";
import anObject from "../internals/an-object";
import anObjectOrUndefined from "../internals/an-object-or-undefined";
import createProperty from "../internals/create-property";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import getBuiltIn from "../internals/get-built-in";
import propertyIsEnumerableModule from "../internals/object-property-is-enumerable";
import getIteratorFlattenable from "../internals/get-iterator-flattenable";
import getModeOption from "../internals/get-mode-option";
import iteratorCloseAll from "../internals/iterator-close-all";
import iteratorZip from "../internals/iterator-zip";
import IS_PURE from "../internals/is-pure";
var create = getBuiltIn('Object', 'create');
var ownKeys = getBuiltIn('Reflect', 'ownKeys');
var push = uncurryThis([].push);
var THROW = 'throw';

// `Iterator.zipKeyed` method
// https://github.com/tc39/proposal-joint-iteration
$({
  target: 'Iterator',
  stat: true,
  forced: IS_PURE
}, {
  zipKeyed: function zipKeyed(iterables /* , options */) {
    anObject(iterables);
    var options = arguments.length > 1 ? anObjectOrUndefined(arguments[1]) : undefined;
    var mode = getModeOption(options);
    var paddingOption = mode === 'longest' ? anObjectOrUndefined(options && options.padding) : undefined;
    var iters = [];
    var padding = [];
    var allKeys = ownKeys(iterables);
    var keys = [];
    var propertyIsEnumerable = propertyIsEnumerableModule.f;
    var i, key, value;
    for (i = 0; i < allKeys.length; i++) try {
      key = allKeys[i];
      if (!call(propertyIsEnumerable, iterables, key)) continue;
      value = iterables[key];
      if (value !== undefined) {
        push(keys, key);
        push(iters, getIteratorFlattenable(value, false));
      }
    } catch (error) {
      return iteratorCloseAll(iters, THROW, error);
    }
    var iterCount = iters.length;
    if (mode === 'longest') {
      if (paddingOption === undefined) {
        for (i = 0; i < iterCount; i++) push(padding, undefined);
      } else {
        for (i = 0; i < keys.length; i++) {
          try {
            value = paddingOption[keys[i]];
          } catch (error) {
            return iteratorCloseAll(iters, THROW, error);
          }
          push(padding, value);
        }
      }
    }
    return iteratorZip(iters, mode, padding, function (results) {
      var obj = create(null);
      for (var j = 0; j < iterCount; j++) {
        createProperty(obj, keys[j], results[j]);
      }
      return obj;
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
