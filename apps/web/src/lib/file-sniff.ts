/**
 * Magic-byte file-type sniffing.
 *
 * Upload routes validate `File.type`, which is the CLIENT-supplied
 * Content-Type — trivially spoofable. An attacker can label arbitrary
 * bytes as `image/png` and have them pinned to IPFS / Cloudflare under
 * our account. This sniffs the actual leading bytes so the declared
 * type has to match the real content.
 *
 * Defense in depth — the size cap is the primary abuse bound; this
 * stops content-type spoofing (non-media payloads, polyglots).
 */

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** True if the bytes look like a supported raster image (jpeg/png/gif/webp). */
export function looksLikeImage(buf: Uint8Array): boolean {
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true;
  // GIF: "GIF8"
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return true;
  // WebP: "RIFF"...."WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return true;
  }
  return false;
}

/** True if the bytes look like a supported video container (mp4/mov/webm). */
export function looksLikeVideo(buf: Uint8Array): boolean {
  // ISO-BMFF (mp4 / mov / m4v): "ftyp" box at offset 4
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) return true;
  // Some .mov start with a "moov" / "mdat" / "free"/"skip"/"wide" atom at offset 4
  for (const atom of [
    [0x6d, 0x6f, 0x6f, 0x76], // moov
    [0x6d, 0x64, 0x61, 0x74], // mdat
    [0x66, 0x72, 0x65, 0x65], // free
    [0x77, 0x69, 0x64, 0x65], // wide
  ]) {
    if (startsWith(buf, atom, 4)) return true;
  }
  // WebM / Matroska: EBML header 1A 45 DF A3
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return true;
  return false;
}

/** Read the leading bytes of a web File for sniffing (default 16). */
export async function readMagic(file: File, n = 16): Promise<Uint8Array> {
  const slice = file.slice(0, n);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}
