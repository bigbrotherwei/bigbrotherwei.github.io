import type { ToolResult } from './result.ts';

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const invalidBase64 = (): ToolResult<never> => ({ ok: false, error: 'Base64 无效' });

const bytesToBinary = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

export const encodeBase64 = (input: string): ToolResult<string> => {
  const bytes = new TextEncoder().encode(input);
  return { ok: true, value: btoa(bytesToBinary(bytes)) };
};

export const decodeBase64 = (input: string): ToolResult<string> => {
  if (!base64Pattern.test(input)) return invalidBase64();

  try {
    const binary = atob(input);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    if (btoa(bytesToBinary(bytes)) !== input) return invalidBase64();

    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return invalidBase64();
  }
};
