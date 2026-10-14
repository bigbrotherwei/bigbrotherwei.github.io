import type { ToolResult } from './result.ts';

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
}

const groups = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
} as const;

export const generatePassword = (
  options: PasswordOptions,
  randomBytes: (count: number) => Uint8Array,
): ToolResult<string> => {
  if (!Number.isInteger(options.length) || options.length < 8 || options.length > 64) {
    return { ok: false, error: '密码长度须为 8 到 64 位整数' };
  }

  const selected = (Object.keys(groups) as (keyof typeof groups)[])
    .filter((group) => options[group])
    .map((group) => groups[group]);
  if (selected.length === 0) return { ok: false, error: '请至少选择一个字符组' };

  const pick = (count: number): number => {
    const limit = Math.floor(256 / count) * count;
    while (true) {
      const bytes = randomBytes(1);
      if (bytes.length !== 1 || !Number.isInteger(bytes[0]) || bytes[0] < 0 || bytes[0] > 255) {
        throw new Error('无效的随机字节');
      }
      if (bytes[0] < limit) return bytes[0] % count;
    }
  };

  try {
    const characters = selected.map((group) => group[pick(group.length)]);
    const alphabet = selected.join('');
    while (characters.length < options.length) characters.push(alphabet[pick(alphabet.length)]);
    for (let index = characters.length - 1; index > 0; index--) {
      const swapIndex = pick(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }
    return { ok: true, value: characters.join('') };
  } catch {
    return { ok: false, error: '安全随机数不可用，请检查浏览器支持' };
  }
};
