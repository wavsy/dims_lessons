export function Scale({ name, label }: { name: string; label: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <label key={score} className="flex-1">
            <input className="peer sr-only" type="radio" name={name} value={score} required />
            <span className="grid h-11 cursor-pointer place-items-center rounded-lg bg-ivory text-sm font-medium shadow-[inset_0_0_0_1px_var(--field-ring)] transition peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
              {score}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
