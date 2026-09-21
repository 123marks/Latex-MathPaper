// Minimal ZIP reader/writer for .vsix (which is a zip). Store on write;
// store + deflate on read. No extra dependency. Zip64, encryption, and
// symbolic links are rejected so a crafted archive cannot escape the
// install directory or ask the host to follow a link.

import { inflateRawSync } from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let crc = i;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  CRC_TABLE[i] = crc >>> 0;
}

export function crc32(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function zipError(message, code = "VSIX_INVALID") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertSafeZipName(name) {
  const normalized = String(name || "").replaceAll("\\", "/");
  if (!normalized) throw zipError("压缩条目名为空", "VSIX_TRAVERSAL");
  if (normalized.startsWith("/") || normalized.startsWith("//")) {
    throw zipError("压缩条目不能是绝对路径", "VSIX_TRAVERSAL");
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    throw zipError("压缩条目不能带盘符", "VSIX_TRAVERSAL");
  }
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "" && parts[parts.length - 1] === "") continue;
    if (part === "" || part === "." || part === "..") {
      throw zipError("压缩条目包含越界路径段", "VSIX_TRAVERSAL");
    }
  }
  return normalized.replace(/\/+$/, "");
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 22 - 0xFFFF);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) !== EOCD_SIG) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen === buf.length) return i;
  }
  throw zipError("不是 ZIP/VSIX（缺少 EOCD）");
}

export function packZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name || "").replaceAll("\\", "/"), "utf8");
    if (!name.length) throw zipError("压缩条目名为空");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "", "utf8");
    const crc = crc32(data);
    const unixMode = entry.unixMode != null ? entry.unixMode : 0o100644;
    const externalAttrs = ((unixMode & 0xFFFF) << 16) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIG, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIG, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(externalAttrs, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

export function extractZipEntries(input, {
  maxFiles = 256,
  maxUncompressed = 16 * 1024 * 1024,
} = {}) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const eocd = findEocd(buf);
  const entriesOnDisk = buf.readUInt16LE(eocd + 8);
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const centralSize = buf.readUInt32LE(eocd + 12);
  const centralOffset = buf.readUInt32LE(eocd + 16);
  if (entriesOnDisk === 0xFFFF || totalEntries === 0xFFFF || centralSize === 0xFFFFFFFF || centralOffset === 0xFFFFFFFF) {
    throw zipError("不支持 Zip64 VSIX", "VSIX_INVALID");
  }
  if (totalEntries > maxFiles) throw zipError(`VSIX 条目超过 ${maxFiles} 个`, "VSIX_TOO_LARGE");
  if (centralOffset + centralSize > buf.length) throw zipError("中央目录越界");

  const files = [];
  let cursor = centralOffset;
  let uncompressedTotal = 0;
  for (let i = 0; i < totalEntries; i += 1) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== CENTRAL_SIG) {
      throw zipError("中央目录损坏");
    }
    const flags = buf.readUInt16LE(cursor + 8);
    const method = buf.readUInt16LE(cursor + 10);
    const crc = buf.readUInt32LE(cursor + 16);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const externalAttrs = buf.readUInt32LE(cursor + 38);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    cursor += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x0001) throw zipError("不支持加密 VSIX");
    const unixMode = (externalAttrs >>> 16) & 0xFFFF;
    if ((unixMode & 0o170000) === 0o120000) {
      throw zipError("拒绝符号链接条目", "VSIX_SYMLINK");
    }
    const isDir = name.endsWith("/") || (unixMode & 0o170000) === 0o040000 || (externalAttrs & 0x10);
    if (isDir) continue;

    const safeName = assertSafeZipName(name);
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL_SIG) {
      throw zipError("本地文件头损坏");
    }
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compressedSize > buf.length) throw zipError("压缩数据越界");
    const compressed = buf.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      try {
        data = inflateRawSync(compressed);
      } catch {
        throw zipError("deflate 解压失败");
      }
    } else {
      throw zipError(`不支持的压缩方法 ${method}`);
    }
    if (data.length !== uncompressedSize) throw zipError("解压长度与目录不符");
    if (crc32(data) !== crc) throw zipError("CRC32 不匹配");
    uncompressedTotal += data.length;
    if (uncompressedTotal > maxUncompressed) {
      throw zipError("解压后超过 16MB", "VSIX_TOO_LARGE");
    }
    files.push({ name: safeName, data });
  }
  return files;
}
