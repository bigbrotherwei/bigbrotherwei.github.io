import type { ToolResult } from './result.ts';

export type RegexMatch = { start: number; end: number; text: string; captures: (string | null)[] };
export type RegexResults = { matches: RegexMatch[]; truncated: boolean };

export const validateRegexRequest = (pattern: string, flags: string, input: string): ToolResult<RegExp> => {
  if (pattern.length > 500) return { ok: false, error: '表达式最多 500 个字符，请缩短后重试' };
  if (input.length > 100_000) return { ok: false, error: '测试文本最多 100,000 个字符，请缩短后重试' };
  if (!/^[gims]*$/.test(flags) || new Set(flags).size !== flags.length) {
    return { ok: false, error: '标志只能使用 g、i、m、s，且不能重复' };
  }
  try {
    return { ok: true, value: new RegExp(pattern, flags) };
  } catch (error) {
    return { ok: false, error: `表达式语法错误：${error instanceof Error ? error.message : String(error)}` };
  }
};

export const runRegex = (pattern: string, flags: string, input: string): ToolResult<RegexResults> => {
  const validation = validateRegexRequest(pattern, flags, input);
  if (!validation.ok) return validation;
  const regex = validation.value;
  const matches: RegexMatch[] = [];
  let truncated = false;
  while (true) {
    const match = regex.exec(input);
    if (!match) break;
    if (matches.length === 1000) {
      truncated = true;
      break;
    }
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      captures: match.slice(1).map((capture) => capture ?? null),
    });
    if (!regex.global) break;
    if (match[0].length === 0) regex.lastIndex = match.index + 1;
  }
  return { ok: true, value: { matches, truncated } };
};

export const summarizeRegexResults = ({ matches, truncated }: RegexResults): string => {
  const lines = matches.map(({ start, end, text, captures }, index) => [
    `匹配 ${index + 1}（${start}–${end}）：${text}`,
    ...captures.map((capture, group) => `捕获 ${group + 1}：${capture ?? '未匹配'}`),
  ].join('\n'));
  return `${matches.length} 个匹配${truncated ? '（仅显示前 1000 个）' : ''}\n${lines.join('\n')}`;
};

export const renderRegexResults = (target: HTMLElement, { matches, truncated }: RegexResults): void => {
  const document = target.ownerDocument;
  const fragment = document.createDocumentFragment();
  for (const { start, end, text, captures } of matches) {
    const row = document.createElement('div');
    row.className = 'tool-regex-row';
    const position = document.createElement('span');
    position.className = 'tool-regex-position';
    position.textContent = `${start}–${end}`;
    const content = document.createElement('span');
    content.className = 'tool-regex-content';
    content.append(document.createTextNode(text || '∅'));
    row.append(position, content);
    captures.forEach((capture, index) => {
      const group = document.createElement('span');
      group.className = 'tool-regex-capture';
      group.append(document.createTextNode(`捕获 ${index + 1}：${capture ?? '未匹配'}`));
      row.append(group);
    });
    fragment.append(row);
  }
  if (truncated) {
    const notice = document.createElement('p');
    notice.textContent = '仅显示前 1000 个匹配，请缩小测试文本。';
    fragment.append(notice);
  }
  target.replaceChildren(fragment);
};
