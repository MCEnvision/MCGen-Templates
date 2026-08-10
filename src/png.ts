import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

export type PngLimits = {
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
};

export const defaultPngLimits: PngLimits = {
  maxBytes: 16 * 1024 * 1024,
  maxWidth: 8192,
  maxHeight: 8192,
  maxPixels: 8192 * 8192,
};

export type PngInfo = {
  bytes: number;
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  hasAlpha: boolean;
  sha256: string;
};

const signature = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function readUint32(bytes: Uint8Array, offset: number): number {
  const first = bytes[offset] ?? 0;
  const second = bytes[offset + 1] ?? 0;
  const third = bytes[offset + 2] ?? 0;
  const fourth = bytes[offset + 3] ?? 0;
  return first * 0x1000000 + second * 0x10000 + third * 0x100 + fourth;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return new TextDecoder("ascii").decode(bytes.slice(offset, offset + 4));
}

export function validatePng(
  input: Uint8Array,
  limits: Partial<PngLimits> = {},
): PngInfo {
  const effective = { ...defaultPngLimits, ...limits };
  if (input.byteLength > effective.maxBytes) {
    throw new Error(`png exceeds ${effective.maxBytes} bytes`);
  }
  if (input.length < 33 || !equalBytes(input.slice(0, 8), signature)) {
    throw new Error("png signature is invalid");
  }
  let offset = 8;
  let state: "before-header" | "header" | "data" | "end" = "before-header";
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= input.length) {
    const length = readUint32(input, offset);
    const end = offset + 12 + length;
    if (end > input.length) throw new Error("png chunk exceeds input");
    const type = chunkType(input, offset + 4);
    const data = input.slice(offset + 8, offset + 8 + length);
    const supplied = readUint32(input, offset + 8 + length);
    const crcInput = input.slice(offset + 4, offset + 8 + length);
    if (crc32(crcInput) !== supplied) {
      throw new Error(`png ${type} crc is invalid`);
    }
    if (type === "IHDR") {
      if (state !== "before-header" || length !== 13)
        throw new Error("png ihdr is invalid");
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      if (data[10] !== 0 || data[11] !== 0)
        throw new Error("png ihdr compression is invalid");
      const interlace = data[12] ?? 0;
      if (
        width < 1 ||
        height < 1 ||
        width > effective.maxWidth ||
        height > effective.maxHeight
      ) {
        throw new Error("png dimensions exceed limits");
      }
      if (width * height > effective.maxPixels)
        throw new Error("png pixel count exceeds limits");
      if (![0, 2, 3, 4, 6].includes(colorType))
        throw new Error("png color type is invalid");
      const validDepths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (!validDepths[colorType]?.includes(bitDepth))
        throw new Error("png bit depth is invalid");
      if (interlace !== 0) throw new Error("png interlace method is invalid");
      state = "header";
    } else if (type === "IDAT") {
      if (state !== "header" && state !== "data")
        throw new Error("png idat is out of order");
      idat.push(data);
      state = "data";
    } else if (type === "IEND") {
      if (length !== 0 || state !== "data")
        throw new Error("png iend is invalid");
      state = "end";
      if (end !== input.length) throw new Error("png has data after iend");
    } else if (type === "PLTE") {
      if (length === 0 || length % 3 !== 0 || length > 768)
        throw new Error("png palette is invalid");
    }
    offset = end;
    if (state === "end") break;
  }
  if (state !== "end") throw new Error("png is incomplete");
  if (idat.length === 0) throw new Error("png has no image data");
  let decoded: Uint8Array;
  try {
    decoded = new Uint8Array(inflateSync(Buffer.concat(idat)));
  } catch {
    throw new Error("png image data is not decodable");
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[
    colorType
  ];
  if (channels === undefined) throw new Error("png color type is invalid");
  const bitsPerPixel = channels * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const expectedBytes = (rowBytes + 1) * height;
  if (decoded.byteLength !== expectedBytes)
    throw new Error("png image data length is invalid");
  return {
    bytes: input.byteLength,
    width,
    height,
    bitDepth,
    colorType,
    hasAlpha: colorType === 4 || colorType === 6,
    sha256: createHash("sha256").update(input).digest("hex"),
  };
}

export function canonicalPng(
  input: Uint8Array,
  limits?: Partial<PngLimits>,
): Uint8Array {
  validatePng(input, limits);
  return new Uint8Array(input);
}
