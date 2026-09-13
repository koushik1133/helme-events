/**
 * Self-contained QR Code encoder (ISO/IEC 18004).
 *
 * No dependencies. Byte mode (UTF-8), versions 1-40, ECC levels L/M/Q/H,
 * full function-pattern placement, Reed-Solomon error correction, block
 * interleaving, all 8 data masks with the standard penalty evaluation.
 *
 * Produces a genuine, scannable QR symbol — not a decorative approximation.
 *
 *   const qr = encodeQR('https://example.com');   // { size, modules, version, ecl }
 *   drawQRToCanvas(canvasEl, 'https://example.com');
 */

/* ---------------------------------------------------------------- tables */

// Error-correction codewords per block, indexed [ecl][version - 1].
const ECC_CODEWORDS_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
      28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
      26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30,
      28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28,
      30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
};

// Number of error-correction blocks, indexed [ecl][version - 1].
const NUM_ERROR_CORRECTION_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
      8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
      17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20,
      23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
      25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
};

// Format-information bits for each ECC level (not the same as its ordinal).
const ECL_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/* ------------------------------------------------------ GF(256) / RS ECC */

/** Multiply two field elements of GF(2^8) modulo x^8 + x^4 + x^3 + x^2 + 1. */
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Coefficients of the Reed-Solomon generator polynomial of the given degree. */
function rsComputeDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1; // Monic: highest-order coefficient is implicit.
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

/** Remainder of `data` divided by `divisor` — i.e. the ECC codewords. */
function rsComputeRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

/* --------------------------------------------------------- capacity math */

/** Number of data modules (i.e. non-function modules) in a symbol of `ver`. */
function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

/** Number of usable (pre-ECC) data codewords for a version and ECC level. */
export function getNumDataCodewords(ver, ecl) {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][ver - 1] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver - 1]
  );
}

/** Split data into blocks, append ECC to each, then interleave per spec. */
function addEccAndInterleave(data, ver, ecl) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver - 1];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver - 1];
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks = [];
  const rsDiv = rsComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsComputeRemainder(dat, rsDiv);
    // Pad short blocks so every block is the same length; the pad slot is
    // skipped during interleaving below.
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }

  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

/* ------------------------------------------------------------- bit buffer */

function appendBits(bits, val, len) {
  for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
}

function toUtf8Bytes(str) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
  // Fallback for environments without TextEncoder.
  const out = [];
  const s = unescape(encodeURIComponent(str));
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

/* ------------------------------------------------------- symbol assembly */

class Symbol_ {
  constructor(version, ecl) {
    this.version = version;
    this.ecl = ecl;
    this.size = version * 4 + 17;
    this.modules = [];
    this.isFunction = [];
    for (let y = 0; y < this.size; y++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFunction.push(new Array(this.size).fill(false));
    }
  }

  setFunctionModule(x, y, isDark) {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  drawFinderPattern(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  drawAlignmentPattern(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  getAlignmentPatternPositions() {
    if (this.version === 1) return [];
    const numAlign = Math.floor(this.version / 7) + 2;
    const step =
      this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  drawFunctionPatterns() {
    // Timing patterns.
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }

    // Finder patterns (with their separators, handled by the 9x9 sweep).
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Alignment patterns.
    const pos = this.getAlignmentPatternPositions();
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        // Skip the three corners occupied by finder patterns.
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === pos.length - 1) ||
          (i === pos.length - 1 && j === 0)
        ) continue;
        this.drawAlignmentPattern(pos[i], pos[j]);
      }
    }

    this.drawFormatBits(0); // Placeholder; the real mask is written later.
    this.drawVersion();
  }

  drawFormatBits(mask) {
    const data = (ECL_FORMAT_BITS[this.ecl] << 3) | mask; // 5 bits
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412; // 15 bits, BCH(15,5) + mask
    const getBit = i => ((bits >>> i) & 1) !== 0;

    // Copy 1 — around the top-left finder.
    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(i));
    this.setFunctionModule(8, 7, getBit(6));
    this.setFunctionModule(8, 8, getBit(7));
    this.setFunctionModule(7, 8, getBit(8));
    for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(i));

    // Copy 2 — split between the top-right and bottom-left finders.
    for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(i));
    for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(i));

    this.setFunctionModule(8, this.size - 8, true); // Always-dark module.
  }

  drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem; // 18 bits, BCH(18,6)
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, bit);
      this.setFunctionModule(b, a, bit);
    }
  }

  drawCodewords(data) {
    let i = 0; // Bit index into data
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // Skip the vertical timing column.
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  applyMask(mask) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: throw new RangeError('Invalid mask');
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  getPenaltyScore() {
    let result = 0;
    const size = this.size;

    // Rule 1 — runs of five or more same-coloured modules in a line.
    for (let y = 0; y < size; y++) {
      let runColor = false;
      let runLen = 0;
      for (let x = 0; x < size; x++) {
        if (this.modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += PENALTY_N1;
          else if (runLen > 5) result++;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }
    for (let x = 0; x < size; x++) {
      let runColor = false;
      let runLen = 0;
      for (let y = 0; y < size; y++) {
        if (this.modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += PENALTY_N1;
          else if (runLen > 5) result++;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }

    // Rule 2 — 2x2 blocks of the same colour.
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = this.modules[y][x];
        if (
          c === this.modules[y][x + 1] &&
          c === this.modules[y + 1][x] &&
          c === this.modules[y + 1][x + 1]
        ) result += PENALTY_N2;
      }
    }

    // Rule 3 — finder-like 1:1:3:1:1 patterns with a 4-module light margin.
    const FINDERISH = [true, false, true, true, true, false, true, false, false, false, false];
    const matches = (get, i, reversed) => {
      for (let k = 0; k < FINDERISH.length; k++) {
        const want = FINDERISH[reversed ? FINDERISH.length - 1 - k : k];
        if (get(i + k) !== want) return false;
      }
      return true;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x + FINDERISH.length <= size; x++) {
        const get = i => this.modules[y][i];
        if (matches(get, x, false)) result += PENALTY_N3;
        if (matches(get, x, true)) result += PENALTY_N3;
      }
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y + FINDERISH.length <= size; y++) {
        const get = i => this.modules[i][x];
        if (matches(get, y, false)) result += PENALTY_N3;
        if (matches(get, y, true)) result += PENALTY_N3;
      }
    }

    // Rule 4 — deviation from a 50% dark ratio.
    let dark = 0;
    for (const row of this.modules) for (const c of row) if (c) dark++;
    const total = size * size;
    const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
    result += Math.max(k, 0) * PENALTY_N4;

    return result;
  }
}

/* ------------------------------------------------------------- public API */

/**
 * Encode `text` as a QR symbol.
 *
 * @param {string} text
 * @param {{ecl?: 'L'|'M'|'Q'|'H', minVersion?: number, maxVersion?: number, mask?: number}} [opts]
 * @returns {{size: number, version: number, ecl: string, mask: number, modules: boolean[][]}}
 */
export function encodeQR(text, opts = {}) {
  const ecl = opts.ecl || 'M';
  if (!ECC_CODEWORDS_PER_BLOCK[ecl]) throw new RangeError(`Unknown ECC level: ${ecl}`);
  const minVersion = Math.max(MIN_VERSION, opts.minVersion || MIN_VERSION);
  const maxVersion = Math.min(MAX_VERSION, opts.maxVersion || MAX_VERSION);

  const bytes = toUtf8Bytes(String(text));

  // Choose the smallest version that fits.
  let version = -1;
  let dataCapacityBits = 0;
  for (let v = minVersion; v <= maxVersion; v++) {
    const capacityBits = getNumDataCodewords(v, ecl) * 8;
    const countBits = v < 10 ? 8 : 16;
    const usedBits = 4 + countBits + bytes.length * 8;
    if (usedBits <= capacityBits) {
      version = v;
      dataCapacityBits = capacityBits;
      break;
    }
  }
  if (version === -1) {
    throw new RangeError(
      `Data too long: ${bytes.length} bytes exceeds capacity at ECC level ${ecl}`
    );
  }

  // Build the bit stream: mode indicator, character count, payload.
  const bits = [];
  appendBits(bits, 0x4, 4); // Byte mode
  appendBits(bits, bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) appendBits(bits, b, 8);

  // Terminator, byte alignment, then alternating pad codewords.
  appendBits(bits, 0, Math.min(4, dataCapacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(bits, pad, 8);
  }

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataCodewords.push(byte);
  }

  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);

  const sym = new Symbol_(version, ecl);
  sym.drawFunctionPatterns();
  sym.drawCodewords(allCodewords);

  // Pick the mask with the lowest penalty (or honour an explicit choice).
  let bestMask = opts.mask;
  if (bestMask === undefined || bestMask === null) {
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      sym.applyMask(m);
      sym.drawFormatBits(m);
      const penalty = sym.getPenaltyScore();
      if (penalty < minPenalty) {
        minPenalty = penalty;
        bestMask = m;
      }
      sym.applyMask(m); // XOR is its own inverse — undo.
    }
  }
  sym.applyMask(bestMask);
  sym.drawFormatBits(bestMask);

  return {
    size: sym.size,
    version: sym.version,
    ecl: sym.ecl,
    mask: bestMask,
    modules: sym.modules
  };
}

/**
 * Render a QR symbol onto a canvas, sized to fill it with an integer module
 * scale and a proper 4-module quiet zone.
 *
 * @returns {{size:number, version:number, ecl:string, mask:number, scale:number}}
 */
export function drawQRToCanvas(canvas, text, opts = {}) {
  const qr = encodeQR(text, opts);
  const quiet = opts.quietZone === undefined ? 4 : opts.quietZone;
  const dark = opts.dark || '#000000';
  const light = opts.light || '#ffffff';

  const totalModules = qr.size + quiet * 2;
  const target = opts.pixelSize || Math.min(canvas.width, canvas.height) || 256;
  // Integer module scale keeps every module crisp — the single biggest factor
  // in whether a phone camera locks on.
  const scale = Math.max(1, Math.floor(target / totalModules));
  const dim = totalModules * scale;

  canvas.width = dim;
  canvas.height = dim;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = dark;
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) {
        ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
  }

  return { ...qr, scale, pixelSize: dim };
}
