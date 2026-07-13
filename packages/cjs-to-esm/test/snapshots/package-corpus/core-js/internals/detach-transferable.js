import globalThis from "../internals/global-this";
import getBuiltInNodeModule from "../internals/get-built-in-node-module";
import PROPER_STRUCTURED_CLONE_TRANSFER from "../internals/structured-clone-proper-transfer";
var structuredClone = globalThis.structuredClone;
var $ArrayBuffer = globalThis.ArrayBuffer;
var $MessageChannel = globalThis.MessageChannel;
var detach = false;
var WorkerThreads, channel, buffer, $detach;
if (PROPER_STRUCTURED_CLONE_TRANSFER) {
  detach = function (transferable) {
    structuredClone(transferable, {
      transfer: [transferable]
    });
  };
} else if ($ArrayBuffer) try {
  if (!$MessageChannel) {
    WorkerThreads = getBuiltInNodeModule('worker_threads');
    if (WorkerThreads) $MessageChannel = WorkerThreads.MessageChannel;
  }
  if ($MessageChannel) {
    channel = new $MessageChannel();
    buffer = new $ArrayBuffer(2);
    $detach = function (transferable) {
      channel.port1.postMessage(null, [transferable]);
    };
    if (buffer.byteLength === 2) {
      $detach(buffer);
      if (buffer.byteLength === 0) detach = $detach;
    }
  }
} catch (error) {/* empty */}
const _cjs_default = detach;
export default _cjs_default;
