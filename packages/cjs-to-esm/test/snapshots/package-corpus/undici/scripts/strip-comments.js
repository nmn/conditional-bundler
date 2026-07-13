import * as _cjs_import from "node:fs";
import * as _cjs_import2 from "node:buffer";
const {
  readFileSync,
  writeFileSync
} = _cjs_import;
const {
  transcode
} = _cjs_import2;
const buffer = transcode ? transcode(readFileSync('./undici-fetch.js'), 'utf8', 'latin1') : readFileSync('./undici-fetch.js');
writeFileSync('./undici-fetch.js', buffer.toString('latin1'));
const _cjs_default = {};
export default _cjs_default;
