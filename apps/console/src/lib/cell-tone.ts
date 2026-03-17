/**
 * Returns the appropriate text color class for a table cell value.
 *
 * Contract:
 * - Populated value (non-null, non-undefined, non-empty string) => "text-foreground"
 * - Empty placeholder (null, undefined, empty string) => "text-muted-foreground"
 * - 0 is considered populated
 * - false is considered populated
 */
export function cellTone(value: unknown): "text-foreground" | "text-muted-foreground" {
  if (value === null || value === undefined || value === "") return "text-muted-foreground";
  return "text-foreground";
}
