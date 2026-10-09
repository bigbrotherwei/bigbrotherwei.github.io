import type { BackgroundKey } from './backgrounds';

export type ToolCategory = 'text' | 'encoding' | 'time' | 'development' | 'file';

export interface ToolCategoryDefinition {
  value: ToolCategory | 'all';
  label: string;
}

export interface ToolDefinition {
  slug: string;
  href: string;
  title: string;
  description: string;
  category: ToolCategory;
  backgroundKey: BackgroundKey;
  searchTerms: string;
}

export const toolCategories: readonly ToolCategoryDefinition[] = [
  { value: 'all', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'encoding', label: '编码' },
  { value: 'time', label: '时间' },
  { value: 'development', label: '开发' },
  { value: 'file', label: '文件' },
];

export const tools: readonly ToolDefinition[] = [
  {
    slug: 'images-pdf',
    href: '/tools/images-pdf/',
    title: '图片合并 PDF',
    description: '按顺序将图片排入 A4 页面，合并下载为 PDF。',
    category: 'file',
    backgroundKey: 'tool-images-pdf',
    searchTerms: '图片 照片 合并 pdf jpeg png webp 文件',
  },
  {
    slug: 'markdown',
    href: '/tools/markdown/',
    title: 'Markdown 预览',
    description: '即时查看 Markdown 排版，可打开本地 .md 文件。',
    category: 'text',
    backgroundKey: 'tool-markdown',
    searchTerms: 'markdown md 预览 文本 表格 代码',
  },
  {
    slug: 'text-diff',
    href: '/tools/text-diff/',
    title: '文本差异对比',
    description: '按行或按词查看两份文本的新增、删除与未变内容。',
    category: 'text',
    backgroundKey: 'tool-text-diff',
    searchTerms: '文本 差异 对比 diff 新增 删除 修改 行 词',
  },
  {
    slug: 'regex',
    href: '/tools/regex/',
    title: '正则测试',
    description: '测试表达式和标志位，查看匹配位置与捕获组。',
    category: 'development',
    backgroundKey: 'tool-regex',
    searchTerms: '正则 regex 表达式 匹配 捕获组 开发',
  },
  {
    slug: 'json',
    href: '/tools/json/',
    title: 'JSON 格式化',
    description: '格式化、压缩和校验 JSON，便于阅读与排查结构问题。',
    category: 'development',
    backgroundKey: 'tool-json',
    searchTerms: 'json 格式化 压缩 校验 开发',
  },
  {
    slug: 'base64',
    href: '/tools/base64/',
    title: 'Base64 编码解码',
    description: '在文本和 Base64 之间转换，保留 UTF-8 内容。',
    category: 'encoding',
    backgroundKey: 'tool-base64',
    searchTerms: 'base64 编码 解码 utf-8',
  },
  {
    slug: 'url',
    href: '/tools/url/',
    title: 'URL 编码解码',
    description: '安全转换 URL 组件，帮助检查查询参数和转义文本。',
    category: 'encoding',
    backgroundKey: 'tool-url',
    searchTerms: 'url 编码 解码 查询参数 转义',
  },
  {
    slug: 'timestamp',
    href: '/tools/timestamp/',
    title: '时间戳转换',
    description: '在 Unix 时间戳和可读日期之间快速换算。',
    category: 'time',
    backgroundKey: 'tool-timestamp',
    searchTerms: '时间戳 timestamp unix 日期 时间',
  },
  {
    slug: 'uuid',
    href: '/tools/uuid/',
    title: 'UUID 生成',
    description: '使用浏览器安全随机数生成一个或一组 UUID。',
    category: 'development',
    backgroundKey: 'tool-uuid',
    searchTerms: 'uuid guid 随机 标识符 开发',
  },
  {
    slug: 'text-counter',
    href: '/tools/text-counter/',
    title: '字数统计',
    description: '统计中英文字符、词语、行数和 UTF-8 字节数。',
    category: 'text',
    backgroundKey: 'tool-text-counter',
    searchTerms: '字数 统计 文本 字符 词语 行数 utf-8',
  },
];
