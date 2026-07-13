import __cjs_dep_0 from "../internals/export";
import __cjs_dep_1 from "../internals/global-this";
import __cjs_dep_2 from "../internals/function-call";
import __cjs_dep_3 from "../internals/descriptors";
import __cjs_dep_4 from "../internals/typed-array-constructors-require-wrappers";
import __cjs_dep_5 from "../internals/array-buffer-view-core";
import __cjs_dep_6 from "../internals/array-buffer";
import __cjs_dep_7 from "../internals/an-instance";
import __cjs_dep_8 from "../internals/create-property-descriptor";
import __cjs_dep_9 from "../internals/create-non-enumerable-property";
import __cjs_dep_10 from "../internals/is-integral-number";
import __cjs_dep_11 from "../internals/to-index";
import __cjs_dep_12 from "../internals/to-offset";
import __cjs_dep_13 from "../internals/to-uint8-clamped";
import __cjs_dep_14 from "../internals/to-property-key";
import __cjs_dep_15 from "../internals/has-own-property";
import __cjs_dep_16 from "../internals/classof";
import __cjs_dep_17 from "../internals/is-object";
import __cjs_dep_18 from "../internals/is-symbol";
import __cjs_dep_19 from "../internals/object-create";
import __cjs_dep_20 from "../internals/object-is-prototype-of";
import __cjs_dep_21 from "../internals/object-set-prototype-of";
import __cjs_dep_22 from "../internals/object-get-own-property-names";
import __cjs_dep_23 from "../internals/typed-array-from";
import __cjs_dep_24 from "../internals/array-iteration";
import __cjs_dep_25 from "../internals/set-species";
import __cjs_dep_26 from "../internals/define-built-in-accessor";
import __cjs_dep_27 from "../internals/object-define-property";
import __cjs_dep_28 from "../internals/object-get-own-property-descriptor";
import __cjs_dep_29 from "../internals/array-from-constructor-and-list";
import __cjs_dep_30 from "../internals/internal-state";
import __cjs_dep_31 from "../internals/inherit-if-required";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "../internals/export":
      return __cjs_dep_0;
    case "../internals/global-this":
      return __cjs_dep_1;
    case "../internals/function-call":
      return __cjs_dep_2;
    case "../internals/descriptors":
      return __cjs_dep_3;
    case "../internals/typed-array-constructors-require-wrappers":
      return __cjs_dep_4;
    case "../internals/array-buffer-view-core":
      return __cjs_dep_5;
    case "../internals/array-buffer":
      return __cjs_dep_6;
    case "../internals/an-instance":
      return __cjs_dep_7;
    case "../internals/create-property-descriptor":
      return __cjs_dep_8;
    case "../internals/create-non-enumerable-property":
      return __cjs_dep_9;
    case "../internals/is-integral-number":
      return __cjs_dep_10;
    case "../internals/to-index":
      return __cjs_dep_11;
    case "../internals/to-offset":
      return __cjs_dep_12;
    case "../internals/to-uint8-clamped":
      return __cjs_dep_13;
    case "../internals/to-property-key":
      return __cjs_dep_14;
    case "../internals/has-own-property":
      return __cjs_dep_15;
    case "../internals/classof":
      return __cjs_dep_16;
    case "../internals/is-object":
      return __cjs_dep_17;
    case "../internals/is-symbol":
      return __cjs_dep_18;
    case "../internals/object-create":
      return __cjs_dep_19;
    case "../internals/object-is-prototype-of":
      return __cjs_dep_20;
    case "../internals/object-set-prototype-of":
      return __cjs_dep_21;
    case "../internals/object-get-own-property-names":
      return __cjs_dep_22;
    case "../internals/typed-array-from":
      return __cjs_dep_23;
    case "../internals/array-iteration":
      return __cjs_dep_24;
    case "../internals/set-species":
      return __cjs_dep_25;
    case "../internals/define-built-in-accessor":
      return __cjs_dep_26;
    case "../internals/object-define-property":
      return __cjs_dep_27;
    case "../internals/object-get-own-property-descriptor":
      return __cjs_dep_28;
    case "../internals/array-from-constructor-and-list":
      return __cjs_dep_29;
    case "../internals/internal-state":
      return __cjs_dep_30;
    case "../internals/inherit-if-required":
      return __cjs_dep_31;
    default:
      throw new Error("Cannot require " + request + " from core-js@3.49.0/internals/typed-array-constructor.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("core-js@3.49.0/internals/typed-array-constructor.js");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0/internals/typed-array-constructor.js", __cjs_exports__);
  ((module, exports, require, process) => {
    'use strict';

    var $ = require('../internals/export');
    var globalThis = require('../internals/global-this');
    var call = require('../internals/function-call');
    var DESCRIPTORS = require('../internals/descriptors');
    var TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS = require('../internals/typed-array-constructors-require-wrappers');
    var ArrayBufferViewCore = require('../internals/array-buffer-view-core');
    var ArrayBufferModule = require('../internals/array-buffer');
    var anInstance = require('../internals/an-instance');
    var createPropertyDescriptor = require('../internals/create-property-descriptor');
    var createNonEnumerableProperty = require('../internals/create-non-enumerable-property');
    var isIntegralNumber = require('../internals/is-integral-number');
    var toIndex = require('../internals/to-index');
    var toOffset = require('../internals/to-offset');
    var toUint8Clamped = require('../internals/to-uint8-clamped');
    var toPropertyKey = require('../internals/to-property-key');
    var hasOwn = require('../internals/has-own-property');
    var classof = require('../internals/classof');
    var isObject = require('../internals/is-object');
    var isSymbol = require('../internals/is-symbol');
    var create = require('../internals/object-create');
    var isPrototypeOf = require('../internals/object-is-prototype-of');
    var setPrototypeOf = require('../internals/object-set-prototype-of');
    var getOwnPropertyNames = require('../internals/object-get-own-property-names').f;
    var typedArrayFrom = require('../internals/typed-array-from');
    var forEach = require('../internals/array-iteration').forEach;
    var setSpecies = require('../internals/set-species');
    var defineBuiltInAccessor = require('../internals/define-built-in-accessor');
    var definePropertyModule = require('../internals/object-define-property');
    var getOwnPropertyDescriptorModule = require('../internals/object-get-own-property-descriptor');
    var arrayFromConstructorAndList = require('../internals/array-from-constructor-and-list');
    var InternalStateModule = require('../internals/internal-state');
    var inheritIfRequired = require('../internals/inherit-if-required');
    var getInternalState = InternalStateModule.get;
    var setInternalState = InternalStateModule.set;
    var enforceInternalState = InternalStateModule.enforce;
    var nativeDefineProperty = definePropertyModule.f;
    var nativeGetOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
    var RangeError = globalThis.RangeError;
    var ArrayBuffer = ArrayBufferModule.ArrayBuffer;
    var ArrayBufferPrototype = ArrayBuffer.prototype;
    var DataView = ArrayBufferModule.DataView;
    var NATIVE_ARRAY_BUFFER_VIEWS = ArrayBufferViewCore.NATIVE_ARRAY_BUFFER_VIEWS;
    var TYPED_ARRAY_TAG = ArrayBufferViewCore.TYPED_ARRAY_TAG;
    var TypedArray = ArrayBufferViewCore.TypedArray;
    var TypedArrayPrototype = ArrayBufferViewCore.TypedArrayPrototype;
    var isTypedArray = ArrayBufferViewCore.isTypedArray;
    var BYTES_PER_ELEMENT = 'BYTES_PER_ELEMENT';
    var WRONG_LENGTH = 'Wrong length';
    var addGetter = function (it, key) {
      defineBuiltInAccessor(it, key, {
        configurable: true,
        get: function () {
          return getInternalState(this)[key];
        }
      });
    };
    var isArrayBuffer = function (it) {
      var klass;
      return isPrototypeOf(ArrayBufferPrototype, it) || (klass = classof(it)) === 'ArrayBuffer' || klass === 'SharedArrayBuffer';
    };
    var isTypedArrayIndex = function (target, key) {
      return isTypedArray(target) && !isSymbol(key) && key in target && isIntegralNumber(+key) && key >= 0;
    };
    var wrappedGetOwnPropertyDescriptor = function getOwnPropertyDescriptor(target, key) {
      key = toPropertyKey(key);
      return isTypedArrayIndex(target, key) ? createPropertyDescriptor(2, target[key]) : nativeGetOwnPropertyDescriptor(target, key);
    };
    var wrappedDefineProperty = function defineProperty(target, key, descriptor) {
      key = toPropertyKey(key);
      if (isTypedArrayIndex(target, key) && isObject(descriptor) && hasOwn(descriptor, 'value') && !hasOwn(descriptor, 'get') && !hasOwn(descriptor, 'set')
      // TODO: add validation descriptor w/o calling accessors
      && !descriptor.configurable && (!hasOwn(descriptor, 'writable') || descriptor.writable) && (!hasOwn(descriptor, 'enumerable') || descriptor.enumerable)) {
        target[key] = descriptor.value;
        return target;
      }
      return nativeDefineProperty(target, key, descriptor);
    };
    if (DESCRIPTORS) {
      if (!NATIVE_ARRAY_BUFFER_VIEWS) {
        getOwnPropertyDescriptorModule.f = wrappedGetOwnPropertyDescriptor;
        definePropertyModule.f = wrappedDefineProperty;
        addGetter(TypedArrayPrototype, 'buffer');
        addGetter(TypedArrayPrototype, 'byteOffset');
        addGetter(TypedArrayPrototype, 'byteLength');
        addGetter(TypedArrayPrototype, 'length');
      }
      $({
        target: 'Object',
        stat: true,
        forced: !NATIVE_ARRAY_BUFFER_VIEWS
      }, {
        getOwnPropertyDescriptor: wrappedGetOwnPropertyDescriptor,
        defineProperty: wrappedDefineProperty
      });
      module.exports = function (TYPE, wrapper, CLAMPED) {
        var BYTES = TYPE.match(/\d+/)[0] / 8;
        var CONSTRUCTOR_NAME = TYPE + (CLAMPED ? 'Clamped' : '') + 'Array';
        var GETTER = 'get' + TYPE;
        var SETTER = 'set' + TYPE;
        var NativeTypedArrayConstructor = globalThis[CONSTRUCTOR_NAME];
        var TypedArrayConstructor = NativeTypedArrayConstructor;
        var TypedArrayConstructorPrototype = TypedArrayConstructor && TypedArrayConstructor.prototype;
        var exported = {};
        var getter = function (that, index) {
          var data = getInternalState(that);
          return data.view[GETTER](index * BYTES + data.byteOffset, true);
        };
        var setter = function (that, index, value) {
          var data = getInternalState(that);
          data.view[SETTER](index * BYTES + data.byteOffset, CLAMPED ? toUint8Clamped(value) : value, true);
        };
        var addElement = function (that, index) {
          nativeDefineProperty(that, index, {
            get: function () {
              return getter(this, index);
            },
            set: function (value) {
              return setter(this, index, value);
            },
            enumerable: true
          });
        };
        if (!NATIVE_ARRAY_BUFFER_VIEWS) {
          TypedArrayConstructor = wrapper(function (that, data, offset, $length) {
            anInstance(that, TypedArrayConstructorPrototype);
            var index = 0;
            var byteOffset = 0;
            var buffer, byteLength, length;
            if (!isObject(data)) {
              length = toIndex(data);
              byteLength = length * BYTES;
              buffer = new ArrayBuffer(byteLength);
            } else if (isArrayBuffer(data)) {
              buffer = data;
              byteOffset = toOffset(offset, BYTES);
              var $len = data.byteLength;
              if ($length === undefined) {
                if ($len % BYTES) throw new RangeError(WRONG_LENGTH);
                byteLength = $len - byteOffset;
                if (byteLength < 0) throw new RangeError(WRONG_LENGTH);
              } else {
                byteLength = toIndex($length) * BYTES;
                if (byteLength + byteOffset > $len) throw new RangeError(WRONG_LENGTH);
              }
              length = byteLength / BYTES;
            } else if (isTypedArray(data)) {
              return arrayFromConstructorAndList(TypedArrayConstructor, data);
            } else {
              return call(typedArrayFrom, TypedArrayConstructor, data);
            }
            setInternalState(that, {
              buffer: buffer,
              byteOffset: byteOffset,
              byteLength: byteLength,
              length: length,
              view: new DataView(buffer)
            });
            while (index < length) addElement(that, index++);
          });
          if (setPrototypeOf) setPrototypeOf(TypedArrayConstructor, TypedArray);
          TypedArrayConstructorPrototype = TypedArrayConstructor.prototype = create(TypedArrayPrototype);
        } else if (TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS) {
          TypedArrayConstructor = wrapper(function (dummy, data, typedArrayOffset, $length) {
            anInstance(dummy, TypedArrayConstructorPrototype);
            return inheritIfRequired(function () {
              if (!isObject(data)) return new NativeTypedArrayConstructor(toIndex(data));
              if (isArrayBuffer(data)) return $length !== undefined ? new NativeTypedArrayConstructor(data, toOffset(typedArrayOffset, BYTES), $length) : typedArrayOffset !== undefined ? new NativeTypedArrayConstructor(data, toOffset(typedArrayOffset, BYTES)) : new NativeTypedArrayConstructor(data);
              if (isTypedArray(data)) return arrayFromConstructorAndList(TypedArrayConstructor, data);
              return call(typedArrayFrom, TypedArrayConstructor, data);
            }(), dummy, TypedArrayConstructor);
          });
          if (setPrototypeOf) setPrototypeOf(TypedArrayConstructor, TypedArray);
          forEach(getOwnPropertyNames(NativeTypedArrayConstructor), function (key) {
            if (!(key in TypedArrayConstructor)) {
              createNonEnumerableProperty(TypedArrayConstructor, key, NativeTypedArrayConstructor[key]);
            }
          });
          TypedArrayConstructor.prototype = TypedArrayConstructorPrototype;
        }
        if (TypedArrayConstructorPrototype.constructor !== TypedArrayConstructor) {
          createNonEnumerableProperty(TypedArrayConstructorPrototype, 'constructor', TypedArrayConstructor);
        }
        enforceInternalState(TypedArrayConstructorPrototype).TypedArrayConstructor = TypedArrayConstructor;
        if (TYPED_ARRAY_TAG) {
          createNonEnumerableProperty(TypedArrayConstructorPrototype, TYPED_ARRAY_TAG, CONSTRUCTOR_NAME);
        }
        var FORCED = TypedArrayConstructor !== NativeTypedArrayConstructor;
        exported[CONSTRUCTOR_NAME] = TypedArrayConstructor;
        $({
          global: true,
          constructor: true,
          forced: FORCED,
          sham: !NATIVE_ARRAY_BUFFER_VIEWS
        }, exported);
        if (!(BYTES_PER_ELEMENT in TypedArrayConstructor)) {
          createNonEnumerableProperty(TypedArrayConstructor, BYTES_PER_ELEMENT, BYTES);
        }
        if (!(BYTES_PER_ELEMENT in TypedArrayConstructorPrototype)) {
          createNonEnumerableProperty(TypedArrayConstructorPrototype, BYTES_PER_ELEMENT, BYTES);
        }
        setSpecies(CONSTRUCTOR_NAME);
      };
    } else module.exports = function () {/* empty */};
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__);
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0/internals/typed-array-constructor.js", __cjs_default__);
}
export default __cjs_default__;
