import type { ToolResult } from './result.ts';

const invalidUuidCount = (): ToolResult<never> => ({ ok: false, error: 'UUID 数量必须为 1 到 20' });
const unavailableUuidGenerator = (): ToolResult<never> => ({ ok: false, error: '安全 UUID 生成功能不可用' });

export const normalizeUuidCount = (input: string): number => {
  const count = Number(input);
  if (!Number.isFinite(count)) return 1;

  return Math.min(20, Math.max(1, Math.trunc(count)));
};

export const generateUuids = (count: number, randomUuid?: () => string): ToolResult<string[]> => {
  if (!Number.isInteger(count) || count < 1 || count > 20) return invalidUuidCount();

  const generator = randomUuid ?? globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (!generator) return unavailableUuidGenerator();

  return { ok: true, value: Array.from({ length: count }, () => generator()) };
};
