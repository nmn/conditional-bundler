import { webidl as _webidl } from "../webidl";
import { kEnumerableProperty as _kEnumerableProperty } from "../../core/util";
import { kConstruct as _kConstruct } from "../../core/symbols";
/**
 * @see https://html.spec.whatwg.org/multipage/comms.html#messageevent
 */
class MessageEvent extends Event {
  #eventInit;
  constructor(type, eventInitDict = {}) {
    if (type === _kConstruct) {
      super(arguments[1], arguments[2]);
      _webidl.util.markAsUncloneable(this);
      return;
    }
    const prefix = 'MessageEvent constructor';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    type = _webidl.converters.DOMString(type, prefix, 'type');
    eventInitDict = _webidl.converters.MessageEventInit(eventInitDict, prefix, 'eventInitDict');
    super(type, eventInitDict);
    this.#eventInit = eventInitDict;
    _webidl.util.markAsUncloneable(this);
  }
  get data() {
    _webidl.brandCheck(this, MessageEvent);
    return this.#eventInit.data;
  }
  get origin() {
    _webidl.brandCheck(this, MessageEvent);
    return this.#eventInit.origin;
  }
  get lastEventId() {
    _webidl.brandCheck(this, MessageEvent);
    return this.#eventInit.lastEventId;
  }
  get source() {
    _webidl.brandCheck(this, MessageEvent);
    return this.#eventInit.source;
  }
  get ports() {
    _webidl.brandCheck(this, MessageEvent);
    if (!Object.isFrozen(this.#eventInit.ports)) {
      Object.freeze(this.#eventInit.ports);
    }
    return this.#eventInit.ports;
  }
  initMessageEvent(type, bubbles = false, cancelable = false, data = null, origin = '', lastEventId = '', source = null, ports = []) {
    _webidl.brandCheck(this, MessageEvent);
    _webidl.argumentLengthCheck(arguments, 1, 'MessageEvent.initMessageEvent');
    return new MessageEvent(type, {
      bubbles,
      cancelable,
      data,
      origin,
      lastEventId,
      source,
      ports
    });
  }
  static createFastMessageEvent(type, init) {
    const messageEvent = new MessageEvent(_kConstruct, type, init);
    messageEvent.#eventInit = init;
    messageEvent.#eventInit.data ??= null;
    messageEvent.#eventInit.origin ??= '';
    messageEvent.#eventInit.lastEventId ??= '';
    messageEvent.#eventInit.source ??= null;
    messageEvent.#eventInit.ports ??= [];
    return messageEvent;
  }
}
const {
  createFastMessageEvent
} = MessageEvent;
delete MessageEvent.createFastMessageEvent;

/**
 * @see https://websockets.spec.whatwg.org/#the-closeevent-interface
 */
class CloseEvent extends Event {
  #eventInit;
  constructor(type, eventInitDict = {}) {
    const prefix = 'CloseEvent constructor';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    type = _webidl.converters.DOMString(type, prefix, 'type');
    eventInitDict = _webidl.converters.CloseEventInit(eventInitDict);
    super(type, eventInitDict);
    this.#eventInit = eventInitDict;
    _webidl.util.markAsUncloneable(this);
  }
  get wasClean() {
    _webidl.brandCheck(this, CloseEvent);
    return this.#eventInit.wasClean;
  }
  get code() {
    _webidl.brandCheck(this, CloseEvent);
    return this.#eventInit.code;
  }
  get reason() {
    _webidl.brandCheck(this, CloseEvent);
    return this.#eventInit.reason;
  }
}

// https://html.spec.whatwg.org/multipage/webappapis.html#the-errorevent-interface
class ErrorEvent extends Event {
  #eventInit;
  constructor(type, eventInitDict) {
    const prefix = 'ErrorEvent constructor';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    super(type, eventInitDict);
    _webidl.util.markAsUncloneable(this);
    type = _webidl.converters.DOMString(type, prefix, 'type');
    eventInitDict = _webidl.converters.ErrorEventInit(eventInitDict ?? {});
    this.#eventInit = eventInitDict;
  }
  get message() {
    _webidl.brandCheck(this, ErrorEvent);
    return this.#eventInit.message;
  }
  get filename() {
    _webidl.brandCheck(this, ErrorEvent);
    return this.#eventInit.filename;
  }
  get lineno() {
    _webidl.brandCheck(this, ErrorEvent);
    return this.#eventInit.lineno;
  }
  get colno() {
    _webidl.brandCheck(this, ErrorEvent);
    return this.#eventInit.colno;
  }
  get error() {
    _webidl.brandCheck(this, ErrorEvent);
    return this.#eventInit.error;
  }
}
Object.defineProperties(MessageEvent.prototype, {
  [Symbol.toStringTag]: {
    value: 'MessageEvent',
    configurable: true
  },
  data: _kEnumerableProperty,
  origin: _kEnumerableProperty,
  lastEventId: _kEnumerableProperty,
  source: _kEnumerableProperty,
  ports: _kEnumerableProperty,
  initMessageEvent: _kEnumerableProperty
});
Object.defineProperties(CloseEvent.prototype, {
  [Symbol.toStringTag]: {
    value: 'CloseEvent',
    configurable: true
  },
  reason: _kEnumerableProperty,
  code: _kEnumerableProperty,
  wasClean: _kEnumerableProperty
});
Object.defineProperties(ErrorEvent.prototype, {
  [Symbol.toStringTag]: {
    value: 'ErrorEvent',
    configurable: true
  },
  message: _kEnumerableProperty,
  filename: _kEnumerableProperty,
  lineno: _kEnumerableProperty,
  colno: _kEnumerableProperty,
  error: _kEnumerableProperty
});
_webidl.converters.MessagePort = _webidl.interfaceConverter(_webidl.is.MessagePort, 'MessagePort');
_webidl.converters['sequence<MessagePort>'] = _webidl.sequenceConverter(_webidl.converters.MessagePort);
const eventInit = [{
  key: 'bubbles',
  converter: _webidl.converters.boolean,
  defaultValue: () => false
}, {
  key: 'cancelable',
  converter: _webidl.converters.boolean,
  defaultValue: () => false
}, {
  key: 'composed',
  converter: _webidl.converters.boolean,
  defaultValue: () => false
}];
_webidl.converters.MessageEventInit = _webidl.dictionaryConverter([...eventInit, {
  key: 'data',
  converter: _webidl.converters.any,
  defaultValue: () => null
}, {
  key: 'origin',
  converter: _webidl.converters.USVString,
  defaultValue: () => ''
}, {
  key: 'lastEventId',
  converter: _webidl.converters.DOMString,
  defaultValue: () => ''
}, {
  key: 'source',
  // Node doesn't implement WindowProxy or ServiceWorker, so the only
  // valid value for source is a MessagePort.
  converter: _webidl.nullableConverter(_webidl.converters.MessagePort),
  defaultValue: () => null
}, {
  key: 'ports',
  converter: _webidl.converters['sequence<MessagePort>'],
  defaultValue: () => []
}]);
_webidl.converters.CloseEventInit = _webidl.dictionaryConverter([...eventInit, {
  key: 'wasClean',
  converter: _webidl.converters.boolean,
  defaultValue: () => false
}, {
  key: 'code',
  converter: _webidl.converters['unsigned short'],
  defaultValue: () => 0
}, {
  key: 'reason',
  converter: _webidl.converters.USVString,
  defaultValue: () => ''
}]);
_webidl.converters.ErrorEventInit = _webidl.dictionaryConverter([...eventInit, {
  key: 'message',
  converter: _webidl.converters.DOMString,
  defaultValue: () => ''
}, {
  key: 'filename',
  converter: _webidl.converters.USVString,
  defaultValue: () => ''
}, {
  key: 'lineno',
  converter: _webidl.converters['unsigned long'],
  defaultValue: () => 0
}, {
  key: 'colno',
  converter: _webidl.converters['unsigned long'],
  defaultValue: () => 0
}, {
  key: 'error',
  converter: _webidl.converters.any
}]);
const _cjs_default = {
  MessageEvent,
  CloseEvent,
  ErrorEvent,
  createFastMessageEvent
};
const _MessageEvent = _cjs_default["MessageEvent"];
export { _MessageEvent as MessageEvent };
const _CloseEvent = _cjs_default["CloseEvent"];
export { _CloseEvent as CloseEvent };
const _ErrorEvent = _cjs_default["ErrorEvent"];
export { _ErrorEvent as ErrorEvent };
const _createFastMessageEvent = _cjs_default["createFastMessageEvent"];
export { _createFastMessageEvent as createFastMessageEvent };
export default _cjs_default;
