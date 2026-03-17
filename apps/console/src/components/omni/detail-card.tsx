import { cn } from "@/lib/utils";

/**
 * DetailCard — Canonical read-mostly grouped details card for Omni.
 *
 * Use this for record summaries, key-value detail groups, and any
 * read-mostly card with a title + structured content.
 *
 * This is the canonical path for new detail/summary surfaces.
 * The workspace Section/FieldRow/DetailGrid family is frozen and
 * should not be used for new work.
 *
 * @example
 * <DetailCard title="Salesforce Account" action={<ExternalLink />}>
 *   <DetailRow label="Account ID" value={id} mono />
 *   <DetailRow label="MRR" value="$12,500" emphasis />
 *   <DetailRow label="CSM" value={csmName} />
 * </DetailCard>
 */

interface DetailCardProps {
  title: string;
  /** Optional count shown beside the title (e.g. line item count) */
  count?: number;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function DetailCard({ title, count, description, action, children, id, className }: DetailCardProps) {
  return (
    <div id={id} className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {title}
            {count != null && (
              <span className="ml-2 font-normal text-muted-foreground">
                ({count})
              </span>
            )}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

/**
 * DetailRow — Key/value row within a DetailCard.
 *
 * Enforces the Omni contrast contract:
 * - Populated value → text-foreground
 * - Empty/missing → text-muted-foreground
 *
 * Accepts ReactNode as value for complex content (badges, links, etc).
 */
export function DetailRow({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && value !== "" && value !== "—";
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm text-right",
          hasValue ? "text-foreground" : "text-muted-foreground",
          mono && "font-mono text-xs",
          emphasis && "font-medium",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
