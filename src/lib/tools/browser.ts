import type { ToolResult } from './result.ts';

export type TransformationMode = 'encode' | 'decode';

export interface TransformationValues {
  input: string;
  output: string;
  mode: TransformationMode;
}

const copyFailure = (): ToolResult<never> => ({ ok: false, error: '复制失败，请检查浏览器权限' });

export const copyText = async (
  value: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard,
): Promise<ToolResult<true>> => {
  if (!clipboard) return copyFailure();

  try {
    await clipboard.writeText(value);
    return { ok: true, value: true };
  } catch {
    return copyFailure();
  }
};

export const debounce = <T extends unknown[]>(callback: (...arguments_: T) => void, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...arguments_: T) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...arguments_), delay);
  };
};

export const swapTransformation = ({ input, output, mode }: TransformationValues): TransformationValues => ({
  input: output,
  output: input,
  mode: mode === 'encode' ? 'decode' : 'encode',
});
