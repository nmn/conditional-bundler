import documentCreateElement from "../internals/document-create-element";
// in old WebKit versions, `element.classList` is not an instance of global `DOMTokenList`

var classList = documentCreateElement('span').classList;
var DOMTokenListPrototype = classList && classList.constructor && classList.constructor.prototype;
const _cjs_default = DOMTokenListPrototype === Object.prototype ? undefined : DOMTokenListPrototype;
export default _cjs_default;
