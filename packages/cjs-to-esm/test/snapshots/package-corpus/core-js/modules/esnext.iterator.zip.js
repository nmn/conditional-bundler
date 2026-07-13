import $ from "../internals/export";
import anObject from "../internals/an-object";
import anObjectOrUndefined from "../internals/an-object-or-undefined";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import getIteratorRecord from "../internals/get-iterator-record";
import getIteratorFlattenable from "../internals/get-iterator-flattenable";
import getModeOption from "../internals/get-mode-option";
import iteratorClose from "../internals/iterator-close";
import iteratorCloseAll from "../internals/iterator-close-all";
import iteratorZip from "../internals/iterator-zip";
import IS_PURE from "../internals/is-pure";
var concat = uncurryThis([].concat);
var push = uncurryThis([].push);
var THROW = 'throw';

// `Iterator.zip` method
// https://github.com/tc39/proposal-joint-iteration
$({
  target: 'Iterator',
  stat: true,
  forced: IS_PURE
}, {
  zip: function zip(iterables /* , options */) {
    anObject(iterables);
    var options = arguments.length > 1 ? anObjectOrUndefined(arguments[1]) : undefined;
    var mode = getModeOption(options);
    var paddingOption = mode === 'longest' ? anObjectOrUndefined(options && options.padding) : undefined;
    var iters = [];
    var padding = [];
    var inputIter = getIteratorRecord(iterables);
    var iter, done, next;
    while (!done) {
      try {
        next = anObject(call(inputIter.next, inputIter.iterator));
        done = next.done;
      } catch (error) {
        return iteratorCloseAll(iters, THROW, error);
      }
      if (!done) {
        try {
          iter = getIteratorFlattenable(next.value, false);
        } catch (error) {
          return iteratorCloseAll(concat([inputIter], iters), THROW, error);
        }
        push(iters, iter);
      }
    }
    var iterCount = iters.length;
    var i, paddingDone, paddingIter;
    if (mode === 'longest') {
      if (paddingOption === undefined) {
        for (i = 0; i < iterCount; i++) push(padding, undefined);
      } else {
        try {
          paddingIter = getIteratorRecord(paddingOption);
        } catch (error) {
          return iteratorCloseAll(iters, THROW, error);
        }
        var usingIterator = true;
        for (i = 0; i < iterCount; i++) {
          if (usingIterator) {
            try {
              next = anObject(call(paddingIter.next, paddingIter.iterator));
              paddingDone = next.done;
              next = next.value;
            } catch (error) {
              return iteratorCloseAll(iters, THROW, error);
            }
            if (paddingDone) {
              usingIterator = false;
            } else {
              push(padding, next);
            }
          } else {
            push(padding, undefined);
          }
        }
        if (usingIterator) {
          try {
            iteratorClose(paddingIter.iterator, 'normal');
          } catch (error) {
            return iteratorCloseAll(iters, THROW, error);
          }
        }
      }
    }
    return iteratorZip(iters, mode, padding);
  }
});
const _cjs_default = {};
export default _cjs_default;
