import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import toIndexedObject from "../internals/to-indexed-object";
import toObject from "../internals/to-object";
import toString from "../internals/to-string";
import lengthOfArrayLike from "../internals/length-of-array-like";
var push = uncurryThis([].push);
var join = uncurryThis([].join);

// `String.raw` method
// https://tc39.es/ecma262/#sec-string.raw
$({
  target: 'String',
  stat: true
}, {
  raw: function raw(template) {
    var rawTemplate = toIndexedObject(toObject(template).raw);
    var literalSegments = lengthOfArrayLike(rawTemplate);
    if (!literalSegments) return '';
    var argumentsLength = arguments.length;
    var elements = [];
    var i = 0;
    while (true) {
      push(elements, toString(rawTemplate[i++]));
      if (i === literalSegments) return join(elements, '');
      if (i < argumentsLength) push(elements, toString(arguments[i]));
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
