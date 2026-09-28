export default function FilterChips({ label, options, selected, onSelect }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm tracking-wide text-muted transition-colors hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
        >
          {option.icon}
          {option.label}
          <span className="tabular-nums">{option.count}</span>
        </button>
      ))}
    </div>
  );
}
