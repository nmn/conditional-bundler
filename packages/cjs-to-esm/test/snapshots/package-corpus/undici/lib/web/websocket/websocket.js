import * as _cjs_import from "node:util/types";
import { webidl as _webidl } from "../webidl";
import { URLSerializer as _URLSerializer } from "../fetch/data-url";
import { environmentSettingsObject as _environmentSettingsObject } from "../fetch/util";
import { staticPropertyDescriptors as _staticPropertyDescriptors, states as _states, sentCloseFrameState as _sentCloseFrameState, sendHints as _sendHints, opcodes as _opcodes } from "./constants";
import { isConnecting as _isConnecting, isEstablished as _isEstablished, isClosing as _isClosing, isClosed as _isClosed, isValidSubprotocol as _isValidSubprotocol, fireEvent as _fireEvent, utf8Decode as _utf8Decode, toArrayBuffer as _toArrayBuffer, getURLRecord as _getURLRecord } from "./util";
import { establishWebSocketConnection as _establishWebSocketConnection, closeWebSocketConnection as _closeWebSocketConnection, failWebsocketConnection as _failWebsocketConnection } from "./connection";
import { ByteParser as _ByteParser } from "./receiver";
import { kEnumerableProperty as _kEnumerableProperty } from "../../core/util";
import { getGlobalDispatcher as _getGlobalDispatcher } from "../../global";
import { ErrorEvent as _ErrorEvent, CloseEvent as _CloseEvent, createFastMessageEvent as _createFastMessageEvent } from "./events";
import { SendQueue as _SendQueue } from "./sender";
import { WebsocketFrameSend as _WebsocketFrameSend } from "./frame";
import { channels as _channels } from "../../core/diagnostics";
const {
  isArrayBuffer
} = _cjs_import;
function getSocketAddress(socket) {
  if (typeof socket?.address === 'function') {
    return socket.address();
  }
  if (typeof socket?.session?.socket?.address === 'function') {
    return socket.session.socket.address();
  }
  return null;
}

/**
 * @typedef {object} Handler
 * @property {(response: any, extensions?: string[]) => void} onConnectionEstablished
 * @property {(opcode: number, data: Buffer) => void} onMessage
 * @property {(error: Error) => void} onParserError
 * @property {() => void} onParserDrain
 * @property {(chunk: Buffer) => void} onSocketData
 * @property {(err: Error) => void} onSocketError
 * @property {() => void} onSocketClose
 * @property {(body: Buffer) => void} onPing
 * @property {(body: Buffer) => void} onPong
 *
 * @property {number} readyState
 * @property {import('stream').Duplex} socket
 * @property {Set<number>} closeState
 * @property {import('../fetch/index').Fetch} controller
 * @property {boolean} [wasEverConnected=false]
 */

// https://websockets.spec.whatwg.org/#interface-definition
class WebSocket extends EventTarget {
  #events = {
    open: null,
    error: null,
    close: null,
    message: null
  };
  #bufferedAmount = 0;
  #protocol = '';
  #extensions = '';

  /** @type {SendQueue} */
  #sendQueue;

  /** @type {Handler} */
  #handler = {
    onConnectionEstablished: (response, extensions) => this.#onConnectionEstablished(response, extensions),
    onMessage: (opcode, data) => this.#onMessage(opcode, data),
    onParserError: err => _failWebsocketConnection(this.#handler, null, err.message),
    onParserDrain: () => this.#onParserDrain(),
    onSocketData: chunk => {
      if (!this.#parser.write(chunk)) {
        this.#handler.socket.pause();
      }
    },
    onSocketError: err => {
      this.#handler.readyState = _states.CLOSING;
      if (_channels.socketError.hasSubscribers) {
        _channels.socketError.publish(err);
      }
      this.#handler.socket.destroy();
    },
    onSocketClose: () => this.#onSocketClose(),
    onPing: body => {
      if (_channels.ping.hasSubscribers) {
        _channels.ping.publish({
          payload: body,
          websocket: this
        });
      }
    },
    onPong: body => {
      if (_channels.pong.hasSubscribers) {
        _channels.pong.publish({
          payload: body,
          websocket: this
        });
      }
    },
    readyState: _states.CONNECTING,
    socket: null,
    closeState: new Set(),
    controller: null,
    wasEverConnected: false
  };
  #url;
  #binaryType;
  /** @type {import('./receiver').ByteParser} */
  #parser;

  /**
   * @param {string} url
   * @param {string|string[]} protocols
   */
  constructor(url, protocols = []) {
    super();
    _webidl.util.markAsUncloneable(this);
    const prefix = 'WebSocket constructor';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    const options = _webidl.converters['DOMString or sequence<DOMString> or WebSocketInit'](protocols, prefix, 'options');
    url = _webidl.converters.USVString(url);
    protocols = options.protocols;

    // 1. Let baseURL be this's relevant settings object's API base URL.
    const baseURL = _environmentSettingsObject.settingsObject.baseUrl;

    // 2. Let urlRecord be the result of getting a URL record given url and baseURL.
    const urlRecord = _getURLRecord(url, baseURL);

    // 3. If protocols is a string, set protocols to a sequence consisting
    //    of just that string.
    if (typeof protocols === 'string') {
      protocols = [protocols];
    }

    // 4. If any of the values in protocols occur more than once or otherwise
    //    fail to match the requirements for elements that comprise the value
    //    of `Sec-WebSocket-Protocol` fields as defined by The WebSocket
    //    protocol, then throw a "SyntaxError" DOMException.
    if (protocols.length !== new Set(protocols.map(p => p.toLowerCase())).size) {
      throw new DOMException('Invalid Sec-WebSocket-Protocol value', 'SyntaxError');
    }
    if (protocols.length > 0 && !protocols.every(p => _isValidSubprotocol(p))) {
      throw new DOMException('Invalid Sec-WebSocket-Protocol value', 'SyntaxError');
    }

    // 5. Set this's url to urlRecord.
    this.#url = new URL(urlRecord.href);

    // 6. Let client be this's relevant settings object.
    const client = _environmentSettingsObject.settingsObject;

    // 7. Run this step in parallel:
    // 7.1. Establish a WebSocket connection given urlRecord, protocols,
    //      and client.
    this.#handler.controller = _establishWebSocketConnection(urlRecord, protocols, client, this.#handler, options);

    // Each WebSocket object has an associated ready state, which is a
    // number representing the state of the connection. Initially it must
    // be CONNECTING (0).
    this.#handler.readyState = WebSocket.CONNECTING;

    // The extensions attribute must initially return the empty string.

    // The protocol attribute must initially return the empty string.

    // Each WebSocket object has an associated binary type, which is a
    // BinaryType. Initially it must be "blob".
    this.#binaryType = 'blob';
  }

  /**
   * @see https://websockets.spec.whatwg.org/#dom-websocket-close
   * @param {number|undefined} code
   * @param {string|undefined} reason
   */
  close(code = undefined, reason = undefined) {
    _webidl.brandCheck(this, WebSocket);
    const prefix = 'WebSocket.close';
    if (code !== undefined) {
      code = _webidl.converters['unsigned short'](code, prefix, 'code', _webidl.attributes.Clamp);
    }
    if (reason !== undefined) {
      reason = _webidl.converters.USVString(reason);
    }

    // 1. If code is the special value "missing", then set code to null.
    code ??= null;

    // 2. If reason is the special value "missing", then set reason to the empty string.
    reason ??= '';

    // 3. Close the WebSocket with this, code, and reason.
    _closeWebSocketConnection(this.#handler, code, reason, true);
  }

  /**
   * @see https://websockets.spec.whatwg.org/#dom-websocket-send
   * @param {NodeJS.TypedArray|ArrayBuffer|Blob|string} data
   */
  send(data) {
    _webidl.brandCheck(this, WebSocket);
    const prefix = 'WebSocket.send';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    data = _webidl.converters.WebSocketSendData(data, prefix, 'data');

    // 1. If this's ready state is CONNECTING, then throw an
    //    "InvalidStateError" DOMException.
    if (_isConnecting(this.#handler.readyState)) {
      throw new DOMException('Sent before connected.', 'InvalidStateError');
    }

    // 2. Run the appropriate set of steps from the following list:
    // https://datatracker.ietf.org/doc/html/rfc6455#section-6.1
    // https://datatracker.ietf.org/doc/html/rfc6455#section-5.2

    if (!_isEstablished(this.#handler.readyState) || _isClosing(this.#handler.readyState)) {
      return;
    }

    // If data is a string
    if (typeof data === 'string') {
      // If the WebSocket connection is established and the WebSocket
      // closing handshake has not yet started, then the user agent
      // must send a WebSocket Message comprised of the data argument
      // using a text frame opcode; if the data cannot be sent, e.g.
      // because it would need to be buffered but the buffer is full,
      // the user agent must flag the WebSocket as full and then close
      // the WebSocket connection. Any invocation of this method with a
      // string argument that does not throw an exception must increase
      // the bufferedAmount attribute by the number of bytes needed to
      // express the argument as UTF-8.

      const buffer = Buffer.from(data);
      this.#bufferedAmount += buffer.byteLength;
      this.#sendQueue.add(buffer, () => {
        this.#bufferedAmount -= buffer.byteLength;
      }, _sendHints.text);
    } else if (isArrayBuffer(data)) {
      // If the WebSocket connection is established, and the WebSocket
      // closing handshake has not yet started, then the user agent must
      // send a WebSocket Message comprised of data using a binary frame
      // opcode; if the data cannot be sent, e.g. because it would need
      // to be buffered but the buffer is full, the user agent must flag
      // the WebSocket as full and then close the WebSocket connection.
      // The data to be sent is the data stored in the buffer described
      // by the ArrayBuffer object. Any invocation of this method with an
      // ArrayBuffer argument that does not throw an exception must
      // increase the bufferedAmount attribute by the length of the
      // ArrayBuffer in bytes.

      this.#bufferedAmount += data.byteLength;
      this.#sendQueue.add(data, () => {
        this.#bufferedAmount -= data.byteLength;
      }, _sendHints.arrayBuffer);
    } else if (ArrayBuffer.isView(data)) {
      // If the WebSocket connection is established, and the WebSocket
      // closing handshake has not yet started, then the user agent must
      // send a WebSocket Message comprised of data using a binary frame
      // opcode; if the data cannot be sent, e.g. because it would need to
      // be buffered but the buffer is full, the user agent must flag the
      // WebSocket as full and then close the WebSocket connection. The
      // data to be sent is the data stored in the section of the buffer
      // described by the ArrayBuffer object that data references. Any
      // invocation of this method with this kind of argument that does
      // not throw an exception must increase the bufferedAmount attribute
      // by the length of data’s buffer in bytes.

      this.#bufferedAmount += data.byteLength;
      this.#sendQueue.add(data, () => {
        this.#bufferedAmount -= data.byteLength;
      }, _sendHints.typedArray);
    } else if (_webidl.is.Blob(data)) {
      // If the WebSocket connection is established, and the WebSocket
      // closing handshake has not yet started, then the user agent must
      // send a WebSocket Message comprised of data using a binary frame
      // opcode; if the data cannot be sent, e.g. because it would need to
      // be buffered but the buffer is full, the user agent must flag the
      // WebSocket as full and then close the WebSocket connection. The data
      // to be sent is the raw data represented by the Blob object. Any
      // invocation of this method with a Blob argument that does not throw
      // an exception must increase the bufferedAmount attribute by the size
      // of the Blob object’s raw data, in bytes.

      this.#bufferedAmount += data.size;
      this.#sendQueue.add(data, () => {
        this.#bufferedAmount -= data.size;
      }, _sendHints.blob);
    }
  }
  get readyState() {
    _webidl.brandCheck(this, WebSocket);

    // The readyState getter steps are to return this's ready state.
    return this.#handler.readyState;
  }
  get bufferedAmount() {
    _webidl.brandCheck(this, WebSocket);
    return this.#bufferedAmount;
  }
  get url() {
    _webidl.brandCheck(this, WebSocket);

    // The url getter steps are to return this's url, serialized.
    return _URLSerializer(this.#url);
  }
  get extensions() {
    _webidl.brandCheck(this, WebSocket);
    return this.#extensions;
  }
  get protocol() {
    _webidl.brandCheck(this, WebSocket);
    return this.#protocol;
  }
  get onopen() {
    _webidl.brandCheck(this, WebSocket);
    return this.#events.open;
  }
  set onopen(fn) {
    _webidl.brandCheck(this, WebSocket);
    if (this.#events.open) {
      this.removeEventListener('open', this.#events.open);
    }
    const listener = _webidl.converters.EventHandlerNonNull(fn);
    if (listener !== null) {
      this.addEventListener('open', listener);
      this.#events.open = fn;
    } else {
      this.#events.open = null;
    }
  }
  get onerror() {
    _webidl.brandCheck(this, WebSocket);
    return this.#events.error;
  }
  set onerror(fn) {
    _webidl.brandCheck(this, WebSocket);
    if (this.#events.error) {
      this.removeEventListener('error', this.#events.error);
    }
    const listener = _webidl.converters.EventHandlerNonNull(fn);
    if (listener !== null) {
      this.addEventListener('error', listener);
      this.#events.error = fn;
    } else {
      this.#events.error = null;
    }
  }
  get onclose() {
    _webidl.brandCheck(this, WebSocket);
    return this.#events.close;
  }
  set onclose(fn) {
    _webidl.brandCheck(this, WebSocket);
    if (this.#events.close) {
      this.removeEventListener('close', this.#events.close);
    }
    const listener = _webidl.converters.EventHandlerNonNull(fn);
    if (listener !== null) {
      this.addEventListener('close', listener);
      this.#events.close = fn;
    } else {
      this.#events.close = null;
    }
  }
  get onmessage() {
    _webidl.brandCheck(this, WebSocket);
    return this.#events.message;
  }
  set onmessage(fn) {
    _webidl.brandCheck(this, WebSocket);
    if (this.#events.message) {
      this.removeEventListener('message', this.#events.message);
    }
    const listener = _webidl.converters.EventHandlerNonNull(fn);
    if (listener !== null) {
      this.addEventListener('message', listener);
      this.#events.message = fn;
    } else {
      this.#events.message = null;
    }
  }
  get binaryType() {
    _webidl.brandCheck(this, WebSocket);
    return this.#binaryType;
  }
  set binaryType(type) {
    _webidl.brandCheck(this, WebSocket);
    if (type !== 'blob' && type !== 'arraybuffer') {
      this.#binaryType = 'blob';
    } else {
      this.#binaryType = type;
    }
  }

  /**
   * @see https://websockets.spec.whatwg.org/#feedback-from-the-protocol
   */
  #onConnectionEstablished(response, parsedExtensions) {
    // processResponse is called when the "response's header list has been received and initialized."
    // once this happens, the connection is open
    this.#handler.socket = response.socket;

    // Get options from dispatcher options
    const maxFragments = this.#handler.controller.dispatcher?.webSocketOptions?.maxFragments;
    const maxPayloadSize = this.#handler.controller.dispatcher?.webSocketOptions?.maxPayloadSize;
    const parser = new _ByteParser(this.#handler, parsedExtensions, {
      maxFragments,
      maxPayloadSize
    });
    parser.on('drain', () => this.#handler.onParserDrain());
    parser.on('error', err => this.#handler.onParserError(err));
    this.#parser = parser;
    this.#sendQueue = new _SendQueue(response.socket);

    // 1. Change the ready state to OPEN (1).
    this.#handler.readyState = _states.OPEN;

    // 2. Change the extensions attribute’s value to the extensions in use, if
    //    it is not the null value.
    // https://datatracker.ietf.org/doc/html/rfc6455#section-9.1
    const extensions = response.headersList.get('sec-websocket-extensions');
    if (extensions !== null) {
      this.#extensions = extensions;
    }

    // 3. Change the protocol attribute’s value to the subprotocol in use, if
    //    it is not the null value.
    // https://datatracker.ietf.org/doc/html/rfc6455#section-1.9
    const protocol = response.headersList.get('sec-websocket-protocol');
    if (protocol !== null) {
      this.#protocol = protocol;
    }

    // 4. Fire an event named open at the WebSocket object.
    _fireEvent('open', this);
    if (_channels.open.hasSubscribers) {
      // Convert headers to a plain object for the event
      const headers = response.headersList.entries;
      _channels.open.publish({
        address: getSocketAddress(response.socket),
        protocol: this.#protocol,
        extensions: this.#extensions,
        websocket: this,
        handshakeResponse: {
          status: response.status,
          statusText: response.statusText,
          headers
        }
      });
    }
  }
  #onMessage(type, data) {
    // 1. If ready state is not OPEN (1), then return.
    if (this.#handler.readyState !== _states.OPEN) {
      return;
    }

    // 2. Let dataForEvent be determined by switching on type and binary type:
    let dataForEvent;
    if (type === _opcodes.TEXT) {
      // -> type indicates that the data is Text
      //      a new DOMString containing data
      try {
        dataForEvent = _utf8Decode(data);
      } catch {
        _failWebsocketConnection(this.#handler, 1007, 'Received invalid UTF-8 in text frame.');
        return;
      }
    } else if (type === _opcodes.BINARY) {
      if (this.#binaryType === 'blob') {
        // -> type indicates that the data is Binary and binary type is "blob"
        //      a new Blob object, created in the relevant Realm of the WebSocket
        //      object, that represents data as its raw data
        dataForEvent = new Blob([data]);
      } else {
        // -> type indicates that the data is Binary and binary type is "arraybuffer"
        //      a new ArrayBuffer object, created in the relevant Realm of the
        //      WebSocket object, whose contents are data
        dataForEvent = _toArrayBuffer(data);
      }
    }

    // 3. Fire an event named message at the WebSocket object, using MessageEvent,
    //    with the origin attribute initialized to the serialization of the WebSocket
    //    object’s url's origin, and the data attribute initialized to dataForEvent.
    _fireEvent('message', this, _createFastMessageEvent, {
      origin: this.#url.origin,
      data: dataForEvent
    });
  }
  #onParserDrain() {
    this.#handler.socket.resume();
  }

  /**
   * @see https://websockets.spec.whatwg.org/#feedback-from-the-protocol
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-7.1.4
   */
  #onSocketClose() {
    // If the TCP connection was closed after the
    // WebSocket closing handshake was completed, the WebSocket connection
    // is said to have been closed _cleanly_.
    const wasClean = this.#handler.closeState.has(_sentCloseFrameState.SENT) && this.#handler.closeState.has(_sentCloseFrameState.RECEIVED);
    let code = 1005;
    let reason = '';
    const result = this.#parser?.closingInfo;
    if (result && !result.error) {
      code = result.code ?? 1005;
      reason = result.reason;
    }

    // 1. Change the ready state to CLOSED (3).
    this.#handler.readyState = _states.CLOSED;

    // 2. If the user agent was required to fail the WebSocket
    //    connection, or if the WebSocket connection was closed
    //    after being flagged as full, fire an event named error
    //    at the WebSocket object.
    if (!this.#handler.closeState.has(_sentCloseFrameState.RECEIVED)) {
      // If _The WebSocket
      // Connection is Closed_ and no Close control frame was received by the
      // endpoint (such as could occur if the underlying transport connection
      // is lost), _The WebSocket Connection Close Code_ is considered to be
      // 1006.
      code = 1006;
      _fireEvent('error', this, (type, init) => new _ErrorEvent(type, init), {
        error: new TypeError(reason)
      });
    }

    // 3. Fire an event named close at the WebSocket object,
    //    using CloseEvent, with the wasClean attribute
    //    initialized to true if the connection closed cleanly
    //    and false otherwise, the code attribute initialized to
    //    the WebSocket connection close code, and the reason
    //    attribute initialized to the result of applying UTF-8
    //    decode without BOM to the WebSocket connection close
    //    reason.
    // TODO: process.nextTick
    _fireEvent('close', this, (type, init) => new _CloseEvent(type, init), {
      wasClean,
      code,
      reason
    });
    if (_channels.close.hasSubscribers) {
      _channels.close.publish({
        websocket: this,
        code,
        reason
      });
    }
  }

  /**
   * @param {WebSocket} ws
   * @param {Buffer|undefined} buffer
   */
  static ping(ws, buffer) {
    if (Buffer.isBuffer(buffer)) {
      if (buffer.length > 125) {
        throw new TypeError('A PING frame cannot have a body larger than 125 bytes.');
      }
    } else if (buffer !== undefined) {
      throw new TypeError('Expected buffer payload');
    }

    // An endpoint MAY send a Ping frame any time after the connection is
    // established and before the connection is closed.
    const readyState = ws.#handler.readyState;
    if (_isEstablished(readyState) && !_isClosing(readyState) && !_isClosed(readyState)) {
      const frame = new _WebsocketFrameSend(buffer);
      ws.#handler.socket.write(frame.createFrame(_opcodes.PING));
    }
  }
}
const {
  ping
} = WebSocket;
Reflect.deleteProperty(WebSocket, 'ping');

// https://websockets.spec.whatwg.org/#dom-websocket-connecting
WebSocket.CONNECTING = WebSocket.prototype.CONNECTING = _states.CONNECTING;
// https://websockets.spec.whatwg.org/#dom-websocket-open
WebSocket.OPEN = WebSocket.prototype.OPEN = _states.OPEN;
// https://websockets.spec.whatwg.org/#dom-websocket-closing
WebSocket.CLOSING = WebSocket.prototype.CLOSING = _states.CLOSING;
// https://websockets.spec.whatwg.org/#dom-websocket-closed
WebSocket.CLOSED = WebSocket.prototype.CLOSED = _states.CLOSED;
Object.defineProperties(WebSocket.prototype, {
  CONNECTING: _staticPropertyDescriptors,
  OPEN: _staticPropertyDescriptors,
  CLOSING: _staticPropertyDescriptors,
  CLOSED: _staticPropertyDescriptors,
  url: _kEnumerableProperty,
  readyState: _kEnumerableProperty,
  bufferedAmount: _kEnumerableProperty,
  onopen: _kEnumerableProperty,
  onerror: _kEnumerableProperty,
  onclose: _kEnumerableProperty,
  close: _kEnumerableProperty,
  onmessage: _kEnumerableProperty,
  binaryType: _kEnumerableProperty,
  send: _kEnumerableProperty,
  extensions: _kEnumerableProperty,
  protocol: _kEnumerableProperty,
  [Symbol.toStringTag]: {
    value: 'WebSocket',
    writable: false,
    enumerable: false,
    configurable: true
  }
});
Object.defineProperties(WebSocket, {
  CONNECTING: _staticPropertyDescriptors,
  OPEN: _staticPropertyDescriptors,
  CLOSING: _staticPropertyDescriptors,
  CLOSED: _staticPropertyDescriptors
});
_webidl.converters['sequence<DOMString>'] = _webidl.sequenceConverter(_webidl.converters.DOMString);
_webidl.converters['DOMString or sequence<DOMString>'] = function (V, prefix, argument) {
  if (_webidl.util.Type(V) === _webidl.util.Types.OBJECT && Symbol.iterator in V) {
    return _webidl.converters['sequence<DOMString>'](V);
  }
  return _webidl.converters.DOMString(V, prefix, argument);
};

// This implements the proposal made in https://github.com/whatwg/websockets/issues/42
_webidl.converters.WebSocketInit = _webidl.dictionaryConverter([{
  key: 'protocols',
  converter: _webidl.converters['DOMString or sequence<DOMString>'],
  defaultValue: () => []
}, {
  key: 'dispatcher',
  converter: _webidl.converters.any,
  defaultValue: () => _getGlobalDispatcher()
}, {
  key: 'headers',
  converter: _webidl.nullableConverter(_webidl.converters.HeadersInit)
}]);
_webidl.converters['DOMString or sequence<DOMString> or WebSocketInit'] = function (V) {
  if (_webidl.util.Type(V) === _webidl.util.Types.OBJECT && !(Symbol.iterator in V)) {
    return _webidl.converters.WebSocketInit(V);
  }
  return {
    protocols: _webidl.converters['DOMString or sequence<DOMString>'](V)
  };
};
_webidl.converters.WebSocketSendData = function (V) {
  if (_webidl.util.Type(V) === _webidl.util.Types.OBJECT) {
    if (_webidl.is.Blob(V)) {
      return V;
    }
    if (_webidl.is.BufferSource(V)) {
      return V;
    }
  }
  return _webidl.converters.USVString(V);
};
const _cjs_default = {
  WebSocket,
  ping
};
const _WebSocket = _cjs_default["WebSocket"];
export { _WebSocket as WebSocket };
const _ping = _cjs_default["ping"];
export { _ping as ping };
export default _cjs_default;
