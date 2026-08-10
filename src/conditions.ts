export type ConditionContext = {
  fields: Readonly<Record<string, unknown>>;
  features: ReadonlySet<string>;
};

const forbidden =
  /(?:process|require|import|fetch|https?:|file:|\\|\.\.\/|\bnew\b|=>)/i;
const atomPattern =
  /^(?:true|false|feature\("([a-z][a-z0-9._-]*)"\)|field\("([a-z][a-z0-9._-]*)"\)(?:\s*(==|!=)\s*"([^"\r\n]*)")?)$/;

function comparable(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return value.toString();
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function split(expression: string, operator: "||" | "&&"): string[] {
  const parts = expression.split(operator).map((part) => part.trim());
  if (parts.some((part) => part.length === 0))
    throw new Error("condition contains an empty expression");
  return parts;
}

function atom(expression: string, context: ConditionContext): boolean {
  const match = atomPattern.exec(expression);
  if (!match)
    throw new Error(
      `condition expression is outside the safe language ${expression}`,
    );
  if (expression === "true") return true;
  if (expression === "false") return false;
  const feature = match[1];
  if (feature) return context.features.has(feature);
  const field = match[2];
  if (!field) return false;
  const value = context.fields[field];
  const operator = match[3];
  const expected = match[4];
  if (!operator) return Boolean(value);
  const actual = comparable(value);
  return operator === "==" ? actual === expected : actual !== expected;
}

function conjunction(expression: string, context: ConditionContext): boolean {
  return split(expression, "&&").every((part) => atom(part, context));
}

export function evaluateCondition(
  expression: string,
  context: ConditionContext,
): boolean {
  const normalized = expression.trim();
  if (!normalized || normalized.length > 1024 || forbidden.test(normalized))
    throw new Error("condition expression is unsafe");
  return split(normalized, "||").some((part) => conjunction(part, context));
}
