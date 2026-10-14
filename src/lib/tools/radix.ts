import type { ToolResult } from './result.ts';

const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const convertRadix = (input: string, fromBase: number, toBase: number): ToolResult<string> => {
  if (![fromBase, toBase].every((base) => Number.isInteger(base) && base >= 2 && base <= 36)) {
    return { ok: false, error: '进制必须是 2 到 36 之间的整数' };
  }

  const trimmed = input.trim().toUpperCase();
  const negative = trimmed.startsWith('-');
  const magnitude = negative ? trimmed.slice(1) : trimmed;
  if (magnitude.length === 0) return { ok: false, error: '请输入整数' };
  if (magnitude.length > 256) return { ok: false, error: '输入不能超过 256 位' };

  let value = 0n;
  for (const character of magnitude) {
    const digit = digits.indexOf(character);
    if (digit < 0 || digit >= fromBase) {
      return { ok: false, error: `输入包含不属于 ${fromBase} 进制的字符` };
    }
    value = value * BigInt(fromBase) + BigInt(digit);
  }

  if (negative) value = -value;
  return { ok: true, value: value.toString(toBase).toUpperCase() };
};
