import $ from "../internals/export";
import createIteratorConstructor from "../internals/iterator-create-constructor";
import createIterResultObject from "../internals/create-iter-result-object";
import requireObjectCoercible from "../internals/require-object-coercible";
import toString from "../internals/to-string";
import InternalStateModule from "../internals/internal-state";
import StringMultibyteModule from "../internals/string-multibyte";
var codeAt = StringMultibyteModule.codeAt;
var charAt = StringMultibyteModule.charAt;
var STRING_ITERATOR = 'String Iterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(STRING_ITERATOR);

// TODO: unify with String#@@iterator
var $StringIterator = createIteratorConstructor(function StringIterator(string) {
  setInternalState(this, {
    type: STRING_ITERATOR,
    string: string,
    index: 0
  });
}, 'String', function next() {
  var state = getInternalState(this);
  var string = state.string;
  var index = state.index;
  var point;
  if (index >= string.length) return createIterResultObject(undefined, true);
  point = charAt(string, index);
  state.index += point.length;
  return createIterResultObject({
    codePoint: codeAt(point, 0),
    position: index
  }, false);
});

// `String.prototype.codePoints` method
// https://github.com/tc39/proposal-string-prototype-codepoints
$({
  target: 'String',
  proto: true,
  forced: true
}, {
  codePoints: function codePoints() {
    return new $StringIterator(toString(requireObjectCoercible(this)));
  }
});
const _cjs_default = {};
export default _cjs_default;
