import uncurryThis from "../internals/function-uncurry-this";
import requireObjectCoercible from "../internals/require-object-coercible";
import toString from "../internals/to-string";
var quot = /"/g;
var replace = uncurryThis(''.replace);

// `CreateHTML` abstract operation
// https://tc39.es/ecma262/#sec-createhtml
const _cjs_default = function (string, tag, attribute, value) {
  var S = toString(requireObjectCoercible(string));
  var p1 = '<' + tag;
  if (attribute !== '') p1 += ' ' + attribute + '="' + replace(toString(value), quot, '&quot;') + '"';
  return p1 + '>' + S + '</' + tag + '>';
};
export default _cjs_default;
