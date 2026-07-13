import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import notARegExp from "../internals/not-a-regexp";
import requireObjectCoercible from "../internals/require-object-coercible";
import toString from "../internals/to-string";
import correctIsRegExpLogic from "../internals/correct-is-regexp-logic";
var stringIndexOf = uncurryThis(''.indexOf);

// `String.prototype.includes` method
// https://tc39.es/ecma262/#sec-string.prototype.includes
$({
  target: 'String',
  proto: true,
  forced: !correctIsRegExpLogic('includes')
}, {
  includes: function includes(searchString /* , position = 0 */) {
    return !!~stringIndexOf(toString(requireObjectCoercible(this)), toString(notARegExp(searchString)), arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
