import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import getBuiltInNodeModule from "../internals/get-built-in-node-module";
import fails from "../internals/fails";
import create from "../internals/object-create";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import { f as _f } from "../internals/object-define-property";
import defineBuiltIn from "../internals/define-built-in";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import hasOwn from "../internals/has-own-property";
import anInstance from "../internals/an-instance";
import anObject from "../internals/an-object";
import errorToString from "../internals/error-to-string";
import normalizeStringArgument from "../internals/normalize-string-argument";
import DOMExceptionConstants from "../internals/dom-exception-constants";
import clearErrorStack from "../internals/error-stack-clear";
import { set as _set, getterFor as _getterFor } from "../internals/internal-state";
import DESCRIPTORS from "../internals/descriptors";
import IS_PURE from "../internals/is-pure";
var defineProperty = _f;
var DOM_EXCEPTION = 'DOMException';
var DATA_CLONE_ERR = 'DATA_CLONE_ERR';
var Error = getBuiltIn('Error');
// NodeJS < 17.0 does not expose `DOMException` to global
var NativeDOMException = getBuiltIn(DOM_EXCEPTION) || function () {
  try {
    // NodeJS < 15.0 does not expose `MessageChannel` to global
    var MessageChannel = getBuiltIn('MessageChannel') || getBuiltInNodeModule('worker_threads').MessageChannel;
    // eslint-disable-next-line es/no-weak-map, unicorn/require-post-message-target-origin -- safe
    new MessageChannel().port1.postMessage(new WeakMap());
  } catch (error) {
    if (error.name === DATA_CLONE_ERR && error.code === 25) return error.constructor;
  }
}();
var NativeDOMExceptionPrototype = NativeDOMException && NativeDOMException.prototype;
var ErrorPrototype = Error.prototype;
var setInternalState = _set;
var getInternalState = _getterFor(DOM_EXCEPTION);
var HAS_STACK = 'stack' in new Error(DOM_EXCEPTION);
var codeFor = function (name) {
  return hasOwn(DOMExceptionConstants, name) && DOMExceptionConstants[name].m ? DOMExceptionConstants[name].c : 0;
};
var $DOMException = function DOMException() {
  anInstance(this, DOMExceptionPrototype);
  var argumentsLength = arguments.length;
  var message = normalizeStringArgument(argumentsLength < 1 ? undefined : arguments[0]);
  var name = normalizeStringArgument(argumentsLength < 2 ? undefined : arguments[1], 'Error');
  var code = codeFor(name);
  setInternalState(this, {
    type: DOM_EXCEPTION,
    name: name,
    message: message,
    code: code
  });
  if (!DESCRIPTORS) {
    this.name = name;
    this.message = message;
    this.code = code;
  }
  if (HAS_STACK) {
    var error = new Error(message);
    error.name = DOM_EXCEPTION;
    defineProperty(this, 'stack', createPropertyDescriptor(1, clearErrorStack(error.stack, 1)));
  }
};
var DOMExceptionPrototype = $DOMException.prototype = create(ErrorPrototype);
var createGetterDescriptor = function (get) {
  return {
    enumerable: true,
    configurable: true,
    get: get
  };
};
var getterFor = function (key) {
  return createGetterDescriptor(function () {
    return getInternalState(this)[key];
  });
};
if (DESCRIPTORS) {
  // `DOMException.prototype.code` getter
  defineBuiltInAccessor(DOMExceptionPrototype, 'code', getterFor('code'));
  // `DOMException.prototype.message` getter
  defineBuiltInAccessor(DOMExceptionPrototype, 'message', getterFor('message'));
  // `DOMException.prototype.name` getter
  defineBuiltInAccessor(DOMExceptionPrototype, 'name', getterFor('name'));
}
defineProperty(DOMExceptionPrototype, 'constructor', createPropertyDescriptor(1, $DOMException));

// FF36- DOMException is a function, but can't be constructed
var INCORRECT_CONSTRUCTOR = fails(function () {
  return !(new NativeDOMException() instanceof Error);
});

// Safari 10.1 / Chrome 32- / IE8- DOMException.prototype.toString bugs
var INCORRECT_TO_STRING = INCORRECT_CONSTRUCTOR || fails(function () {
  return ErrorPrototype.toString !== errorToString || String(new NativeDOMException(1, 2)) !== '2: 1';
});

// Deno 1.6.3- DOMException.prototype.code just missed
var INCORRECT_CODE = INCORRECT_CONSTRUCTOR || fails(function () {
  return new NativeDOMException(1, 'DataCloneError').code !== 25;
});

// Deno 1.6.3- DOMException constants just missed
var MISSED_CONSTANTS = INCORRECT_CONSTRUCTOR || NativeDOMException[DATA_CLONE_ERR] !== 25 || NativeDOMExceptionPrototype[DATA_CLONE_ERR] !== 25;
var FORCED_CONSTRUCTOR = IS_PURE ? INCORRECT_TO_STRING || INCORRECT_CODE || MISSED_CONSTANTS : INCORRECT_CONSTRUCTOR;

// `DOMException` constructor
// https://webidl.spec.whatwg.org/#idl-DOMException
$({
  global: true,
  constructor: true,
  forced: FORCED_CONSTRUCTOR
}, {
  DOMException: FORCED_CONSTRUCTOR ? $DOMException : NativeDOMException
});
var PolyfilledDOMException = getBuiltIn(DOM_EXCEPTION);
var PolyfilledDOMExceptionPrototype = PolyfilledDOMException.prototype;
if (INCORRECT_TO_STRING && (IS_PURE || NativeDOMException === PolyfilledDOMException)) {
  defineBuiltIn(PolyfilledDOMExceptionPrototype, 'toString', errorToString);
}
if (INCORRECT_CODE && DESCRIPTORS && NativeDOMException === PolyfilledDOMException) {
  defineBuiltInAccessor(PolyfilledDOMExceptionPrototype, 'code', createGetterDescriptor(function () {
    return codeFor(anObject(this).name);
  }));
}

// `DOMException` constants
for (var key in DOMExceptionConstants) if (hasOwn(DOMExceptionConstants, key)) {
  var constant = DOMExceptionConstants[key];
  var constantName = constant.s;
  var descriptor = createPropertyDescriptor(6, constant.c);
  if (!hasOwn(PolyfilledDOMException, constantName)) {
    defineProperty(PolyfilledDOMException, constantName, descriptor);
  }
  if (!hasOwn(PolyfilledDOMExceptionPrototype, constantName)) {
    defineProperty(PolyfilledDOMExceptionPrototype, constantName, descriptor);
  }
}
const _cjs_default = {};
export default _cjs_default;
