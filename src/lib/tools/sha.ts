import type { ToolResult } from './result.ts';

export type ShaAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export const digestBytes = async (
  bytes: ArrayBuffer,
  algorithm: ShaAlgorithm,
  subtle: SubtleCrypto,
): Promise<string> => {
  const digest = await subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const validateHashFile = (file: Pick<File, 'size'>): ToolResult<void> =>
  file.size > 32 * 1024 * 1024
    ? { ok: false, error: '文件不能超过 32 MiB' }
    : { ok: true, value: undefined };
