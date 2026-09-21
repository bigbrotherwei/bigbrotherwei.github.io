import type { ToolResult } from './result.ts';

export interface TimestampResult {
  milliseconds: number;
  seconds: number;
  local: string;
  iso: string;
}

const invalidTimestamp = (): ToolResult<never> => ({ ok: false, error: '时间戳无效' });

export const convertTimestamp = (
  input: string,
  unit: 'auto' | 'seconds' | 'milliseconds',
): ToolResult<TimestampResult> => {
  if (input.trim() === '') return invalidTimestamp();

  const numericValue = Number(input);
  if (!Number.isFinite(numericValue)) return invalidTimestamp();

  const isSeconds = unit === 'seconds' || (unit === 'auto' && Math.abs(numericValue) < 100_000_000_000);
  const milliseconds = isSeconds ? numericValue * 1000 : numericValue;
  const date = new Date(milliseconds);

  if (!Number.isFinite(milliseconds) || Number.isNaN(date.getTime())) return invalidTimestamp();

  return {
    ok: true,
    value: {
      milliseconds,
      seconds: milliseconds / 1000,
      local: date.toLocaleString(),
      iso: date.toISOString(),
    },
  };
};
