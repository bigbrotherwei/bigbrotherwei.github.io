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

const findFunctionScope = (node) => {
  let current = node;
  while (current.parent) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return current;
};

const isInUnreachableFalseBranch = (node, scope) => {
  let current = node;
  while (current.parent && current !== scope) {
    const parent = current.parent;
    if (ts.isIfStatement(parent)
      && parent.thenStatement === current
      && parent.expression.kind === ts.SyntaxKind.FalseKeyword) {
      return true;
    }
    current = parent;
  }
  return false;
};

const getBindingContext = (assignment) => {
  if (!assignment.statement || !ts.isBlock(assignment.statement.parent)) return null;
  const block = assignment.statement.parent;
  const index = block.statements.findIndex((statement) => statement === assignment.statement);
  return index === -1 ? null : { block, index };
};

const statementDeclaresAny = (statement, names) => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) => getBindingNames(declaration.name)
      .some((name) => names.has(name)));
  }
  return (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
    && Boolean(statement.name && names.has(statement.name.text));
};

const walkAfterBinding = (assignment, visit) => {
  const context = getBindingContext(assignment);
  if (!context) return;
  const names = new Set(assignment.names);
  const scope = findFunctionScope(assignment.statement);
  const walk = (node) => {
    if (node !== scope && ts.isFunctionLike(node)) return;
    if (ts.isBlock(node) && node !== context.block && node.statements.some((statement) => statementDeclaresAny(statement, names))) {
      return;
    }
    visit(node, scope);
    ts.forEachChild(node, walk);
  };
  context.block.statements.slice(context.index + 1).forEach((statement) => walk(statement));
};

const isResultProperty = (node, names, property) => ts.isPropertyAccessExpression(node)
  && ts.isIdentifier(node.expression)
  && names.has(node.expression.text)
  && node.name.text === property;

const containsResultProperty = (node, names, property) => {
  let found = false;
  const visit = (child) => {
    if (isResultProperty(child, names, property)) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const hasToolResultConsumption = (assignment) => {
  if (!assignment.statement) return false;
  const names = new Set(assignment.names);
  let checksOk = false;
  let consumesValueOrError = false;

  walkAfterBinding(assignment, (node, scope) => {
    if (isInUnreachableFalseBranch(node, scope)) return;
    if (ts.isIfStatement(node) && containsResultProperty(node.expression, names, 'ok')) checksOk = true;
    if (isResultProperty(node, names, 'value') || isResultProperty(node, names, 'error')) {
      consumesValueOrError = true;
    }
  });

  return checksOk && consumesValueOrError;
};

const containsResultValue = (node, names) => {
  let found = false;
  const visit = (child) => {
    if (ts.isIdentifier(child) && names.has(child.text)) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const isConsoleCall = (node) => ts.isCallExpression(node)
  && ts.isPropertyAccessExpression(node.expression)
  && ts.isIdentifier(node.expression.expression)
  && node.expression.expression.text === 'console';

const hasDomOrArgumentConsumption = (assignment) => {
  if (!assignment.statement) return false;
  const names = new Set(assignment.names);
  let consumed = false;

  walkAfterBinding(assignment, (node, scope) => {
    if (consumed || isInUnreachableFalseBranch(node, scope)) return;
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ['value', 'textContent'].includes(node.left.name.text)
      && containsResultValue(node.right, names)) {
      consumed = true;
      return;
    }
    if (ts.isCallExpression(node) && !isConsoleCall(node)
      && node.arguments.some((argument) => containsResultValue(argument, names))) {
      consumed = true;
    }
  });

  return consumed;
};

const isSwapConsumed = (assignment) => {
  if (!assignment.statement || assignment.names.length !== 1) return false;
  const [name] = assignment.names;

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

  walkAfterBinding(assignment, (node, scope) => {
    if (!isInUnreachableFalseBranch(node, scope)) visit(node);
  });
  return consumed.input && consumed.output && consumed.mode;
};

const collectScriptFacts = (scripts) => {
  const sourceFile = ts.createSourceFile('tool-page.ts', scripts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Set();
  const namedImports = new Map();
  const calls = new Map();
  const forbidden = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const moduleName = statement.moduleSpecifier.text;
      imports.add(moduleName);
      const bindings = namedImports.get(moduleName) ?? new Map();
      const elements = statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements
        : [];
      for (const element of elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        const locals = bindings.get(importedName) ?? new Set();
        locals.add(element.name.text);
        bindings.set(importedName, locals);
      }
      namedImports.set(moduleName, bindings);
    }
  }

  const isGlobalObject = (node) => ts.isIdentifier(node) && ['window', 'globalThis', 'navigator'].includes(node.text);
  const globalInitializerFor = (node) => {
    let current = node;
    while (current.parent && !ts.isVariableDeclaration(current)) current = current.parent;
    return ts.isVariableDeclaration(current) && current.initializer && isGlobalObject(current.initializer);
  };
  const isUnsafeIdentifier = (node) => {
    if (!forbiddenApiNames.has(node.text)) return false;
    const parent = node.parent;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
    if (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) {
      return globalInitializerFor(parent);
    }
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
      return isGlobalObject(parent.expression);
    }
    return true;
  };

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const existing = calls.get(node.expression.text) ?? [];
      existing.push(node);
      calls.set(node.expression.text, existing);
    }
    if (ts.isIdentifier(node) && isUnsafeIdentifier(node)) forbidden.add(node.text);
    if (ts.isElementAccessExpression(node)
      && ts.isStringLiteral(node.argumentExpression)
      && forbiddenApiNames.has(node.argumentExpression.text)
      && isGlobalObject(node.expression)) {
      forbidden.add(node.argumentExpression.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return { imports, namedImports, calls, forbidden };
};

const isBindingName = (node, name) => ts.isIdentifier(node) && node.text === name;

const hasBindingInNode = (node, name, { includeVar = false } = {}) => {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (ts.isVariableDeclaration(child)
      && isBindingName(child.name, name)
      && (includeVar || child.parent.flags & ts.NodeFlags.Let || child.parent.flags & ts.NodeFlags.Const)) {
      found = true;
      return;
    }
    if ((ts.isFunctionDeclaration(child) || ts.isClassDeclaration(child))
      && child.name && isBindingName(child.name, name)) {
      found = true;
      return;
    }
    if (child !== node && ts.isFunctionLike(child)) return;
    if (child !== node && ts.isBlock(child)) return;
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
};

const hasLexicalBindingInScope = (scope, name) => {
  if (ts.isFunctionLike(scope)) {
    if (scope.name && isBindingName(scope.name, name)) return true;
    if (scope.parameters.some((parameter) => isBindingName(parameter.name, name))) return true;
    return false;
  }
  if (ts.isCatchClause(scope) && scope.variableDeclaration
    && isBindingName(scope.variableDeclaration.name, name)) return true;
  return hasBindingInNode(scope, name);
};

const hasVarBindingInFunction = (functionScope, name) => {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (node !== functionScope && ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node)
      && isBindingName(node.name, name)
      && (node.parent.flags & ts.NodeFlags.Var)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(functionScope, visit);
  return found;
};

const resolvesToNamedImport = (identifier, expectedImport) => {
  let current = identifier.parent;
  let functionScope = null;
  while (current) {
    if (ts.isFunctionLike(current)) {
      functionScope = current;
      if (current.name && isBindingName(current.name, identifier.text)) return false;
      if (current.parameters.some((parameter) => isBindingName(parameter.name, identifier.text))) return false;
    }
    if (ts.isCatchClause(current) && current.variableDeclaration
      && isBindingName(current.variableDeclaration.name, identifier.text)) return false;
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      if (hasLexicalBindingInScope(current, identifier.text)) return false;
    }
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  if (functionScope && hasVarBindingInFunction(functionScope, identifier.text)) return false;
  return identifier.text === expectedImport.localName;
};

const hasBoundNamedImportCall = (calls, functionName, importedLocals) => [...calls].some((call) => {
  if (!ts.isIdentifier(call.expression) || !importedLocals.has(call.expression.text)) return false;
  return resolvesToNamedImport(call.expression, { localName: functionName });
});

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

  const requiredCalls = [
    ...contract.logicCalls.map((functionName) => [functionName, contract.logicModule]),
    ...(contract.browserCalls ?? []).map((functionName) => [functionName, contract.browserModule]),
  ];
  for (const [functionName, moduleName] of requiredCalls) {
    const importedLocals = moduleName ? facts.namedImports.get(`../../lib/tools/${moduleName}`)?.get(functionName) : undefined;
    if (!importedLocals?.has(functionName)) {
      failures.push(`must import ${functionName} as a named binding from ${moduleName}`);
    }
    if (!importedLocals?.has(functionName)
      || !hasBoundNamedImportCall(facts.calls.get(functionName) ?? [], functionName, importedLocals)) {
      failures.push(`must call ${functionName} from a page script`);
    }
  }

  for (const functionName of contract.toolResultCalls ?? []) {
    const calls = facts.calls.get(functionName) ?? [];
    const hasToolResult = calls.some((call) => {
      const assignment = findAssignedResult(call);
      return assignment && hasToolResultConsumption(assignment);
    });
    if (!hasToolResult) failures.push(`must consume ${functionName} ToolResult with .ok and .value/.error`);
  }

  for (const functionName of contract.sinkCalls ?? []) {
    const calls = facts.calls.get(functionName) ?? [];
    const hasSink = calls.some((call) => {
      const assignment = findAssignedResult(call);
      return assignment && hasDomOrArgumentConsumption(assignment);
    });
    if (!hasSink) failures.push(`must send ${functionName} result to a DOM update or function argument`);
  }

  if (contract.swapCall) {
    const swapCalls = facts.calls.get(contract.swapCall) ?? [];
    const hasSwap = swapCalls.some((call) => {
      const assignment = findAssignedResult(call);
      return assignment && isSwapConsumed(assignment);
    });
    if (!hasSwap) failures.push(`must assign and consume ${contract.swapCall} result`);
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
