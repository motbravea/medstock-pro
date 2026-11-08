import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

const baseField =
  "w-full rounded-xl border border-subtle bg-surface text-default placeholder:text-subtle " +
  "outline-none transition-all duration-150 " +
  "focus:border-[var(--color-brand-700)] focus:ring-brand " +
  "disabled:cursor-not-allowed disabled:opacity-60";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    trailingIcon,
    className,
    id,
    ...rest
  },
  ref,
) {
  const inputId = id ?? `field-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-default"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
            {leadingIcon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            baseField,
            "h-10 px-3 text-sm",
            leadingIcon && "pl-10",
            trailingIcon && "pr-10",
            error && "border-red-400 focus:border-red-500 focus:ring-red-100",
            className,
          )}
          {...rest}
        />
        {trailingIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
            {trailingIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, className, id, ...rest },
    ref,
  ) {
    const inputId = id ?? `field-${Math.random().toString(36).slice(2, 8)}`;
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-default"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            baseField,
            "px-3 py-2 text-sm leading-relaxed min-h-[80px] resize-none",
            error && "border-red-400 focus:border-red-500 focus:ring-red-100",
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldProps & {
    options: { value: string; label: string }[];
  };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `field-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-default"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        ref={ref}
        className={cn(
          baseField,
          "h-10 px-3 text-sm appearance-none bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22><path d=%22M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.4a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z%22/></svg>')]",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
