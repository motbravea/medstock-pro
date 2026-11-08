import { useCountUp } from "../../hooks/useCountUp";

export function CountUp({
  value,
  duration = 600,
  className,
  decimals = 0,
}: {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
}) {
  const animated = useCountUp(value, duration);
  return (
    <span className={className}>
      {animated.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
    </span>
  );
}
