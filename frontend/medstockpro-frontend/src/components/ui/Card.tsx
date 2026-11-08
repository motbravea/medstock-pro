import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  hoverable?: boolean;
  padded?: boolean;
};

export function Card({
  className,
  hoverable,
  padded = true,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-subtle bg-surface shadow-card transition-all duration-200",
        hoverable && "hover:shadow-card-hover hover:-translate-y-px",
        padded && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-default truncate">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
