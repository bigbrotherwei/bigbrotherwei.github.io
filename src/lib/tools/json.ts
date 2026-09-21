import type { ToolResult } from './result.ts';

const jsonNumber = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const unsafeIntegerError = 'JSON 包含超出 JavaScript 安全整数范围的整数，无法转换以避免精度丢失。';
const unsupportedNumberError = 'JSON 包含超出 JavaScript 数值范围的数字，无法转换以避免数值改写。';

const findUnsafeNumberError = (input: string): string | undefined => {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character !== '-' && !/\d/u.test(character)) continue;

    jsonNumber.lastIndex = index;
    const match = jsonNumber.exec(input);
    if (!match) continue;

    const number = Number(match[0]);
    if (!Number.isFinite(number)) return unsupportedNumberError;
    if (Number.isInteger(number) && !Number.isSafeInteger(number)) return unsafeIntegerError;
    index = jsonNumber.lastIndex - 1;
  }

  return undefined;
};

const parseJson = (input: string): ToolResult<unknown> => {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析 JSON';
    return { ok: false, error: `JSON 无效：${message}` };
  }
};

export const formatJson = (input: string): ToolResult<string> => {
  const result = parseJson(input);
  const numberError = result.ok ? findUnsafeNumberError(input) : undefined;
  if (numberError) return { ok: false, error: numberError };
  return result.ok
    ? { ok: true, value: JSON.stringify(result.value, null, 2) as string }
    : result;
};

export const minifyJson = (input: string): ToolResult<string> => {
  const result = parseJson(input);
  const numberError = result.ok ? findUnsafeNumberError(input) : undefined;
  if (numberError) return { ok: false, error: numberError };
  return result.ok
    ? { ok: true, value: JSON.stringify(result.value) as string }
    : result;
};

export const validateJson = (input: string): ToolResult<true> => {
  const result = parseJson(input);
  return result.ok ? { ok: true, value: true } : result;
};
