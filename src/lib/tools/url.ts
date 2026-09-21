import type { ToolResult } from './result.ts';

const invalidUrlComponent = (error: unknown): ToolResult<never> => ({
  ok: false,
  error: `URL 组件无效：${error instanceof Error ? error.message : '无法处理 URL 组件'}`,
});

export const encodeUrlComponent = (input: string): ToolResult<string> => {
  try {
    return { ok: true, value: encodeURIComponent(input) };
  } catch (error) {
    return invalidUrlComponent(error);
  }
};

export const decodeUrlComponent = (input: string): ToolResult<string> => {
  try {
    return { ok: true, value: decodeURIComponent(input) };
  } catch (error) {
    return invalidUrlComponent(error);
  }
};
