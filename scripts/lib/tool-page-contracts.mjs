import ts from 'typescript';

const stripComments = (source) => source
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');

const forbiddenApiNames = new Set(['fetch', 'localStorage', 'sessionStorage']);

const getScriptSource = (source) => [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .join('\n');

const getBindingNames = (name) => {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((element) => ts.isBindingElement(element) ? getBindingNames(element.name) : []);
  }
  return [];
};

const findStatement = (node) => {
  let current = node;
  while (current.parent && !ts.isStatement(current)) current = current.parent;
  return ts.isStatement(current) ? current : null;
};

const findAssignedResult = (call) => {
  let current = call;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isVariableDeclaration(parent) && parent.initializer && parent.pos <= call.pos && parent.end >= call.end) {
      const names = getBindingNames(parent.name);
      if (names.length > 0) return { names, statement: findStatement(parent) };
    }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(parent.left)) {
      return { names: [parent.left.text], statement: findStatement(parent) };
    }
    current = parent;
  }
  return null;
};

const containsIdentifier = (node, names) => {
  let found = false;
  const visit = (child) => {
    if (ts.isIdentifier(child) && names.has(child.text)) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
};

const isConsumedImmediately = (assignment) => {
  if (!assignment.statement || !ts.isBlock(assignment.statement.parent)) return false;
  const statements = assignment.statement.parent.statements;
  const index = statements.findIndex((statement) => statement === assignment.statement);
  if (index === -1) return false;
  const names = new Set(assignment.names);
  return statements.slice(index + 1, index + 4).some((statement) => containsIdentifier(statement, names));
};

const isSwapConsumed = (assignment) => {
  if (!assignment.statement || assignment.names.length !== 1 || !ts.isBlock(assignment.statement.parent)) return false;
  const [name] = assignment.names;
  const statements = assignment.statement.parent.statements;
  const index = statements.findIndex((statement) => statement === assignment.statement);
  if (index === -1) return false;

  const consumed = { input: false, output: false, mode: false };
  const propertyFromResult = (node, property) => ts.isPropertyAccessExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === name
    && node.name.text === property;
  const isFieldAssignment = (node, field, property) => ts.isBinaryExpression(node)
    && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && ts.isPropertyAccessExpression(node.left)
    && ts.isIdentifier(node.left.expression)
    && node.left.expression.text === field
    && node.left.name.text === 'value'
    && propertyFromResult(node.right, property);
  const visit = (node) => {
    if (isFieldAssignment(node, 'input', 'input')) consumed.input = true;
    if (isFieldAssignment(node, 'output', 'output')) consumed.output = true;
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'setMode'
      && node.arguments.some((argument) => propertyFromResult(argument, 'mode'))) {
      consumed.mode = true;
    }
    ts.forEachChild(node, visit);
  };

  statements.slice(index + 1, index + 5).forEach((statement) => visit(statement));
  return consumed.input && consumed.output && consumed.mode;
};

const collectScriptFacts = (scripts) => {
  const sourceFile = ts.createSourceFile('tool-page.ts', scripts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Set();
  const calls = new Map();
  const forbidden = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.add(statement.moduleSpecifier.text);
    }
  }

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const existing = calls.get(node.expression.text) ?? [];
      existing.push(node);
      calls.set(node.expression.text, existing);
    }
    if (ts.isIdentifier(node) && forbiddenApiNames.has(node.text)) forbidden.add(node.text);
    if (ts.isElementAccessExpression(node)
      && ts.isStringLiteral(node.argumentExpression)
      && forbiddenApiNames.has(node.argumentExpression.text)) {
      forbidden.add(node.argumentExpression.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return { imports, calls, forbidden };
};

export const validateToolPageContract = (source, contract) => {
  const failures = [];
  const cleaned = stripComments(source);
  const scripts = getScriptSource(cleaned);
  const facts = collectScriptFacts(scripts);
  const layoutPattern = new RegExp(`<ToolLayout\\b(?=[^>]*\\bbackgroundKey=\"${contract.backgroundKey}\")[^>]*>[\\s\\S]*<\\/ToolLayout>`);

  if (!layoutPattern.test(cleaned)) {
    failures.push(`must render ToolLayout with backgroundKey \"${contract.backgroundKey}\"`);
  }

  const requiredModules = [contract.logicModule, ...(contract.browserModule ? [contract.browserModule] : [])];
  for (const moduleName of requiredModules) {
    if (!facts.imports.has(`../../lib/tools/${moduleName}`)) {
      failures.push(`must statically import ${moduleName} from a page script`);
    }
  }

  const requiredCalls = [...contract.logicCalls, ...(contract.browserCalls ?? [])];
  for (const functionName of requiredCalls) {
    if (!facts.calls.has(functionName)) {
      failures.push(`must call ${functionName} from a page script`);
    }
  }

  for (const functionName of contract.valueCalls ?? []) {
    const calls = facts.calls.get(functionName) ?? [];
    const hasConsumedResult = calls.some((call) => {
      const assignment = findAssignedResult(call);
      if (!assignment || !isConsumedImmediately(assignment)) return false;
      return contract.swapCall === functionName ? isSwapConsumed(assignment) : true;
    });
    if (!hasConsumedResult) failures.push(`must assign and consume ${functionName} result`);
  }

  const labels = [...cleaned.matchAll(/<label\b[^>]*\bfor=\"([^\"]+)\"[^>]*>/g)].map((match) => match[1]);
  if (labels.length === 0) failures.push('must render a label associated with an input control');
  const labeledIds = new Set(labels);
  for (const id of labels) {
    const controlPattern = new RegExp(`<(?:input|textarea|select)\\b[^>]*\\bid=\"${id}\"[^>]*>`);
    if (!controlPattern.test(cleaned)) failures.push(`label for \"${id}\" must match a control id`);
  }

  const controls = [...cleaned.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)];
  if (controls.length === 0) failures.push('must render an input control');
  for (const control of controls) {
    const id = control[0].match(/\bid=\"([^\"]+)\"/)?.[1];
    if (id && labeledIds.has(id) && /\baria-label\s*=/.test(control[0])) {
      failures.push(`control \"${id}\" must not override its visible label with aria-label`);
    }
  }

  if (!scripts.includes('addEventListener(')) failures.push('must attach an event handler to an interactive control');
  for (const name of facts.forbidden) failures.push(`must not use ${name}`);
  return failures;
};
