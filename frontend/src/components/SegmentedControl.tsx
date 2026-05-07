import { cn } from "../lib/cn";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="space-y-2">
      <div className="field-label">{label}</div>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-white p-1">
        {options.map((option) => (
          <button
            className={cn(
              "h-10 rounded text-sm font-medium transition",
              option.value === value ? "bg-court-600 text-white" : "text-slate-700 hover:bg-court-50",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

