const ANNOTATION_KEYWORDS = new Set(['$schema', '$id', '$comment', 'title', 'description', 'examples', 'default']);
const REF_PREFIX = '#/$defs/';

function fail(message) {
  throw new Error(`json-schema: ${message}`);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.hasOwn(object, key);
}

const TYPE_PREDICATES = {
  string: (value) => typeof value === 'string',
  integer: (value) => Number.isInteger(value),
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  object: isPlainObject,
  array: (value) => Array.isArray(value),
  null: (value) => value === null,
};

function shapeCheck(keyword, accepts, expectation) {
  return (value, schemaPath) => {
    if (!accepts(value)) {
      fail(`"${keyword}" must be ${expectation} at ${schemaPath}`);
    }
  };
}

function countCheck(keyword) {
  return shapeCheck(keyword, (value) => Number.isInteger(value) && value >= 0, 'a non-negative integer');
}

function boundCheck(keyword) {
  return shapeCheck(keyword, (value) => typeof value === 'number' && Number.isFinite(value), 'a finite number');
}

function isTypeName(name) {
  return typeof name === 'string' && hasOwn(TYPE_PREDICATES, name);
}

function isTypeDeclaration(value) {
  return Array.isArray(value) ? value.length > 0 && value.every(isTypeName) : isTypeName(value);
}

function assertRef(value, schemaPath, root) {
  const name = typeof value === 'string' && value.startsWith(REF_PREFIX) ? value.slice(REF_PREFIX.length) : '';
  const resolves = name !== '' && !name.includes('/') && isPlainObject(root.$defs) && hasOwn(root.$defs, name);
  if (!resolves) {
    fail(`"$ref" must be "#/$defs/<name>" naming a root $defs entry, got ${JSON.stringify(value)} at ${schemaPath}`);
  }
}

function assertPattern(value, schemaPath) {
  shapeCheck('pattern', (pattern) => typeof pattern === 'string', 'a string')(value, schemaPath);
  try {
    new RegExp(value, 'u');
  } catch (error) {
    fail(`"pattern" must be a valid regular expression (${error.message}) at ${schemaPath}`);
  }
}

function assertSchemaMap(keyword) {
  return (value, schemaPath, root) => {
    shapeCheck(keyword, isPlainObject, 'an object of schemas')(value, schemaPath);
    for (const [name, child] of Object.entries(value)) {
      assertSchema(child, `${schemaPath}/${keyword}/${name}`, root);
    }
  };
}

function assertSchemaList(keyword) {
  return (value, schemaPath, root) => {
    const isFilledArray = (list) => Array.isArray(list) && list.length > 0;
    shapeCheck(keyword, isFilledArray, 'a non-empty array of schemas')(value, schemaPath);
    value.forEach((child, index) => assertSchema(child, `${schemaPath}/${keyword}/${index}`, root));
  };
}

const KEYWORD_ASSERTIONS = {
  $defs: assertSchemaMap('$defs'),
  $ref: assertRef,
  type: shapeCheck('type', isTypeDeclaration, `one or more of ${Object.keys(TYPE_PREDICATES).join(', ')}`),
  const: () => {},
  enum: shapeCheck('enum', Array.isArray, 'an array'),
  pattern: assertPattern,
  minLength: countCheck('minLength'),
  maxLength: countCheck('maxLength'),
  minimum: boundCheck('minimum'),
  maximum: boundCheck('maximum'),
  required: shapeCheck('required', (value) => Array.isArray(value) && value.every(isString), 'an array of strings'),
  properties: assertSchemaMap('properties'),
  additionalProperties: (value, schemaPath, root) => {
    if (typeof value !== 'boolean') {
      assertSchema(value, `${schemaPath}/additionalProperties`, root);
    }
  },
  minProperties: countCheck('minProperties'),
  items: (value, schemaPath, root) => assertSchema(value, `${schemaPath}/items`, root),
  minItems: countCheck('minItems'),
  maxItems: countCheck('maxItems'),
  uniqueItems: shapeCheck('uniqueItems', (value) => typeof value === 'boolean', 'a boolean'),
  allOf: assertSchemaList('allOf'),
  anyOf: assertSchemaList('anyOf'),
  oneOf: assertSchemaList('oneOf'),
};

function isString(value) {
  return typeof value === 'string';
}

function assertSchema(schema, schemaPath, root) {
  if (!isPlainObject(schema)) {
    fail(`expected a schema object at ${schemaPath}`);
  }
  for (const [keyword, value] of Object.entries(schema)) {
    if (ANNOTATION_KEYWORDS.has(keyword)) {
      continue;
    }
    if (!hasOwn(KEYWORD_ASSERTIONS, keyword)) {
      fail(`the validator does not enforce "${keyword}" at ${schemaPath}`);
    }
    KEYWORD_ASSERTIONS[keyword](value, schemaPath, root);
  }
}

function deepEqual(left, right) {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    const sameLength = Array.isArray(left) && Array.isArray(right) && left.length === right.length;
    return sameLength && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = Object.keys(left);
    const sameKeys = keys.length === Object.keys(right).length;
    return sameKeys && keys.every((key) => hasOwn(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}

function problem(path, text) {
  return { path, problem: text };
}

function validateAnyValue(schema, value, path) {
  const problems = [];
  if (hasOwn(schema, 'type')) {
    const names = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!names.some((name) => TYPE_PREDICATES[name](value))) {
      problems.push(problem(path, `must be of type ${names.join(' or ')}`));
    }
  }
  if (hasOwn(schema, 'const') && !deepEqual(schema.const, value)) {
    problems.push(problem(path, `must equal ${JSON.stringify(schema.const)}`));
  }
  if (hasOwn(schema, 'enum') && !schema.enum.some((member) => deepEqual(member, value))) {
    problems.push(problem(path, `must be one of ${schema.enum.map((member) => JSON.stringify(member)).join(', ')}`));
  }
  return problems;
}

function validateString(schema, value, path) {
  const problems = [];
  const length = [...value].length;
  if (hasOwn(schema, 'pattern') && !new RegExp(schema.pattern, 'u').test(value)) {
    problems.push(problem(path, `must match pattern ${schema.pattern}`));
  }
  if (hasOwn(schema, 'minLength') && length < schema.minLength) {
    problems.push(problem(path, `must have at least ${schema.minLength} characters`));
  }
  if (hasOwn(schema, 'maxLength') && length > schema.maxLength) {
    problems.push(problem(path, `must have at most ${schema.maxLength} characters`));
  }
  return problems;
}

function validateNumber(schema, value, path) {
  const problems = [];
  if (hasOwn(schema, 'minimum') && !(value >= schema.minimum)) {
    problems.push(problem(path, `must be >= ${schema.minimum}`));
  }
  if (hasOwn(schema, 'maximum') && !(value <= schema.maximum)) {
    problems.push(problem(path, `must be <= ${schema.maximum}`));
  }
  return problems;
}

function validateObject(schema, value, path, root) {
  const problems = [];
  for (const key of schema.required ?? []) {
    if (!hasOwn(value, key)) {
      problems.push(problem(`${path}.${key}`, 'is required'));
    }
  }
  if (hasOwn(schema, 'minProperties') && Object.keys(value).length < schema.minProperties) {
    problems.push(problem(path, `must have at least ${schema.minProperties} properties`));
  }
  const properties = schema.properties ?? {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (hasOwn(properties, key)) {
      problems.push(...validateNode(properties[key], child, childPath, root, []));
    } else if (schema.additionalProperties === false) {
      problems.push(problem(childPath, 'has an unexpected key'));
    } else if (isPlainObject(schema.additionalProperties)) {
      problems.push(...validateNode(schema.additionalProperties, child, childPath, root, []));
    }
  }
  return problems;
}

function validateArray(schema, value, path, root) {
  const problems = [];
  if (hasOwn(schema, 'minItems') && value.length < schema.minItems) {
    problems.push(problem(path, `must have at least ${schema.minItems} items`));
  }
  if (hasOwn(schema, 'maxItems') && value.length > schema.maxItems) {
    problems.push(problem(path, `must have at most ${schema.maxItems} items`));
  }
  const hasDuplicate = value.some((item, index) => value.findIndex((other) => deepEqual(item, other)) !== index);
  if (schema.uniqueItems === true && hasDuplicate) {
    problems.push(problem(path, 'must have unique items'));
  }
  if (hasOwn(schema, 'items')) {
    value.forEach((item, index) => {
      problems.push(...validateNode(schema.items, item, `${path}[${index}]`, root, []));
    });
  }
  return problems;
}

function validateCombinators(schema, value, path, root, activeRefs) {
  const problems = [];
  const outcomes = (subschemas) => subschemas.map((sub) => validateNode(sub, value, path, root, activeRefs));
  if (hasOwn(schema, 'allOf')) {
    problems.push(...outcomes(schema.allOf).flat());
  }
  if (hasOwn(schema, 'anyOf') && !outcomes(schema.anyOf).some((found) => found.length === 0)) {
    problems.push(problem(path, 'must match at least one of the allowed schemas'));
  }
  if (hasOwn(schema, 'oneOf')) {
    const matches = outcomes(schema.oneOf).filter((found) => found.length === 0).length;
    if (matches !== 1) {
      problems.push(problem(path, `must match exactly one of the allowed schemas (matched ${matches})`));
    }
  }
  return problems;
}

function validateRef(schema, value, path, root, activeRefs) {
  const name = schema.$ref.slice(REF_PREFIX.length);
  if (activeRefs.includes(name)) {
    fail(`"$ref" cycle: "${schema.$ref}" refers back to itself without consuming any of the value`);
  }
  return validateNode(root.$defs[name], value, path, root, [...activeRefs, name]);
}

function validateNode(schema, value, path, root, activeRefs) {
  const problems = hasOwn(schema, '$ref') ? validateRef(schema, value, path, root, activeRefs) : [];
  problems.push(...validateAnyValue(schema, value, path));
  if (typeof value === 'string') {
    problems.push(...validateString(schema, value, path));
  }
  if (typeof value === 'number') {
    problems.push(...validateNumber(schema, value, path));
  }
  if (isPlainObject(value)) {
    problems.push(...validateObject(schema, value, path, root));
  }
  if (Array.isArray(value)) {
    problems.push(...validateArray(schema, value, path, root));
  }
  problems.push(...validateCombinators(schema, value, path, root, activeRefs));
  return problems;
}

export function validateJsonSchema(schema, value) {
  assertSchema(schema, '#', schema);
  return validateNode(schema, value, '$', schema, []);
}
