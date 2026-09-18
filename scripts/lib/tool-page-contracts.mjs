const stripComments = (source) => source
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');

const stripStringLiterals = (source) => source.replace(/'(\\.|[^'\\])*'|"(\\.|[^"\\])*"|`(\\.|[^`\\])*`/g, "''");

const forbiddenApis = [
  ['window.fetch', /\bwindow\s*\.\s*fetch\b/],
  ['globalThis.fetch', /\bglobalThis\s*\.\s*fetch\b/],
  ['fetch', /(?<![.\w])fetch\s*\(/],
  ['window.localStorage', /\bwindow\s*\.\s*localStorage\b/],
  ['globalThis.localStorage', /\bglobalThis\s*\.\s*localStorage\b/],
  ['localStorage', /(?<![.\w])localStorage\b/],
  ['window.sessionStorage', /\bwindow\s*\.\s*sessionStorage\b/],
  ['globalThis.sessionStorage', /\bglobalThis\s*\.\s*sessionStorage\b/],
  ['sessionStorage', /(?<![.\w])sessionStorage\b/],
];

export const validateToolPageContract = (source, contract) => {
  const failures = [];
  const cleaned = stripComments(source);
  const scripts = [...cleaned.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n');
  const callableScripts = stripStringLiterals(scripts);
  const layoutPattern = new RegExp(`<ToolLayout\\b(?=[^>]*\\bbackgroundKey=\"${contract.backgroundKey}\")[^>]*>[\\s\\S]*<\\/ToolLayout>`);

  if (!layoutPattern.test(cleaned)) {
    failures.push(`must render ToolLayout with backgroundKey \"${contract.backgroundKey}\"`);
  }

  if (!scripts.includes(`../../lib/tools/${contract.logicModule}`)) {
    failures.push(`must import ${contract.logicModule} from a page script`);
  }

  for (const functionName of [...contract.logicCalls, ...(contract.browserCalls ?? [])]) {
    if (!new RegExp(`\\b${functionName}\\s*\\(`).test(callableScripts)) {
      failures.push(`must call ${functionName} from a page script`);
    }
  }

  const labels = [...cleaned.matchAll(/<label\b[^>]*\bfor=\"([^\"]+)\"[^>]*>/g)].map((match) => match[1]);
  if (labels.length === 0) {
    failures.push('must render a label associated with an input control');
  }
  for (const id of labels) {
    const controlPattern = new RegExp(`<(?:input|textarea|select)\\b[^>]*\\bid=\"${id}\"[^>]*>`);
    if (!controlPattern.test(cleaned)) {
      failures.push(`label for \"${id}\" must match a control id`);
    }
  }

  if (!/<(?:input|textarea|select)\b/.test(cleaned)) {
    failures.push('must render an input control');
  }

  if (!scripts.includes('addEventListener(')) {
    failures.push('must attach an event handler to an interactive control');
  }

  for (const [name, pattern] of forbiddenApis) {
    if (pattern.test(cleaned)) {
      failures.push(`must not use ${name}`);
    }
  }

  return failures;
};
