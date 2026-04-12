/**
 * Custom ESLint rule: forbid direct arithmetic on identifiers whose names end
 * in `_cents` or `_hundredths`. Integer math must go through helpers in
 * src/calc/int.ts.
 *
 * Rationale: spec §7.2 layer 6. Enforces that a drive-by `x * 1.5` on a money
 * field cannot sneak in without lint failing.
 */
'use strict';

const FORBIDDEN_SUFFIXES = ['_cents', '_hundredths'];

function identifierLooksLikeIntegerField(name) {
  if (typeof name !== 'string') return false;
  return FORBIDDEN_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function nodeReferencesIntegerField(node) {
  if (!node) return false;
  if (node.type === 'Identifier') return identifierLooksLikeIntegerField(node.name);
  if (node.type === 'MemberExpression' && node.property && node.property.type === 'Identifier') {
    return identifierLooksLikeIntegerField(node.property.name);
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct arithmetic on _cents / _hundredths fields; use src/calc/int helpers.',
    },
    schema: [],
    messages: {
      forbidden:
        'Do not use `{{op}}` directly on `{{name}}`. Integer math must go through src/calc/int helpers (addCents, mulHundredths, etc.).',
    },
  },
  create(context) {
    // Allow arithmetic inside src/calc/int.ts — that IS the helper module.
    const filename = context.getFilename();
    if (filename.endsWith('/calc/int.ts') || filename.endsWith('\\calc\\int.ts')) {
      return {};
    }
    return {
      BinaryExpression(node) {
        if (!['+', '-', '*', '/', '%'].includes(node.operator)) return;
        const offender = nodeReferencesIntegerField(node.left)
          ? node.left
          : nodeReferencesIntegerField(node.right)
            ? node.right
            : null;
        if (!offender) return;
        const name =
          offender.type === 'Identifier' ? offender.name : offender.property.name;
        context.report({
          node,
          messageId: 'forbidden',
          data: { op: node.operator, name },
        });
      },
      AssignmentExpression(node) {
        if (!['+=', '-=', '*=', '/=', '%='].includes(node.operator)) return;
        if (!nodeReferencesIntegerField(node.left)) return;
        const name =
          node.left.type === 'Identifier' ? node.left.name : node.left.property.name;
        context.report({
          node,
          messageId: 'forbidden',
          data: { op: node.operator, name },
        });
      },
    };
  },
};
