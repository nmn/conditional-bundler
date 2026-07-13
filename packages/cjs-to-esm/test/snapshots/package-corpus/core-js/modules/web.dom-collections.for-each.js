import globalThis from "../internals/global-this";
import DOMIterables from "../internals/dom-iterables";
import DOMTokenListPrototype from "../internals/dom-token-list-prototype";
import forEach from "../internals/array-for-each";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
var handlePrototype = function (CollectionPrototype) {
  // some Chrome versions have non-configurable methods on DOMTokenList
  if (CollectionPrototype && CollectionPrototype.forEach !== forEach) try {
    createNonEnumerableProperty(CollectionPrototype, 'forEach', forEach);
  } catch (error) {
    CollectionPrototype.forEach = forEach;
  }
};
for (var COLLECTION_NAME in DOMIterables) {
  if (DOMIterables[COLLECTION_NAME]) {
    handlePrototype(globalThis[COLLECTION_NAME] && globalThis[COLLECTION_NAME].prototype);
  }
}
handlePrototype(DOMTokenListPrototype);
const _cjs_default = {};
export default _cjs_default;
