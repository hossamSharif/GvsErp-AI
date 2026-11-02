import { EXPENSE_CATEGORY_VALUES } from '@erp/shared';

/**
 * Display label for an expense category name. Built-in defaults are stored by
 * key (e.g. "rent") and translated; user-defined names are shown as-is.
 *
 * @param t - translator scoped to the `expenses` namespace
 */
export function labelForExpenseCategory(
  name: string,
  t: (key: never) => string
): string {
  if ((EXPENSE_CATEGORY_VALUES as readonly string[]).includes(name)) {
    return t(`categories.${name}` as never);
  }
  return name;
}
