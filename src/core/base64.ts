/** UTF-8 safe base64 helpers that work in the browser and in Node (tests). */

const hasBtoa = typeof globalThis.btoa === 'function' && typeof globalThis.atob === 'function';

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (hasBtoa) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return globalThis.btoa(binary);
  }
  const buffer = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (buffer) return buffer.from(bytes).toString('base64');
  throw new Error('No base64 implementation available');
}

export function decodeBase64(data: string): string {
  if (hasBtoa) {
    const binary = globalThis.atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const buffer = (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer;
  if (buffer) return buffer.from(data, 'base64').toString('utf8');
  throw new Error('No base64 implementation available');
}

/** Short, human readable fingerprint of a save (used for the share text). */
export function checksum(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)).slice(0, 8).toUpperCase();
}
