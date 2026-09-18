import type { ToolResult } from './result.ts';

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
  return result.ok
    ? { ok: true, value: JSON.stringify(result.value, null, 2) as string }
    : result;
};

export const minifyJson = (input: string): ToolResult<string> => {
  const result = parseJson(input);
  return result.ok
    ? { ok: true, value: JSON.stringify(result.value) as string }
    : result;
};

export const validateJson = (input: string): ToolResult<true> => {
  const result = parseJson(input);
  return result.ok ? { ok: true, value: true } : result;
};
