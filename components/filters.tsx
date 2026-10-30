"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLOR_SWATCH, featureGroups, featureLabels, popularFeatureSlugs, type ExteriorColor } from "@/lib/listings";
import { buttonClasses } from "@/components/ui/button";
import { normalizeRangePair } from "@/lib/catalog-params";
import { useCatalogFilters, type ChoiceField, type MultiChoiceField, type RangeField } from "@/components/catalog-filter-state";

export function Filters({ resultCount }: { resultCount: number | null }) {
  const filters = useCatalogFilters();
  const [open, setOpen] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const dialogRef = useDialog(open, close, triggerRef);
  const showLabel = resultCount === null
    ? "Show cars"
    : `Show ${new Intl.NumberFormat("en-CA").format(resultCount)} ${resultCount === 1 ? "car" : "cars"}`;

  // Closing the sheet uncovers the page; swallow the rest of a double-click or ghost tap so it
  // cannot land on a card or the bottom nav and navigate away before the filters apply.
  const [shield, setShield] = useState(false);
  useEffect(() => {
    if (!shield) return;
    const timer = setTimeout(() => setShield(false), 500);
    return () => clearTimeout(timer);
  }, [shield]);

  function showResults() {
    setShield(true);
    setOpen(false);
    document.getElementById("marketplace-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-label="Vehicle search filters" className="md:rounded-card md:border md:border-line md:bg-surface md:p-5 md:shadow-card">
      <h2 className="sr-only font-body text-xl font-extrabold text-ink md:not-sr-only md:mb-3 md:block">Search cars</h2>

      <div className="hidden gap-3 md:grid md:grid-cols-2">
        <ChoiceSelect label="Make" field={filters.make} placeholder="All makes" />
        <ChoiceSelect label="Model" field={filters.model} placeholder={filters.make.value ? "All models" : "Select make first"} disabled={!filters.make.value} />
        <ChoiceSelect label="Location" field={filters.city} placeholder="All Alberta" />
        <PriceRange field={filters.price} />
      </div>

      <button
        ref={triggerRef}
        type="button"
        className={buttonClasses("secondary", "lg", "w-full md:mt-3 md:w-auto")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {`Filters (${filters.activeCount})`}
      </button>

      {filters.chips.length > 0 && (
        <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
          {filters.chips.map((chip) => (
            <li key={chip.id}>
              <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary-strong hover:bg-primary-muted" onClick={chip.onRemove}><span>{chip.label}</span><span aria-hidden="true">×</span></button>
            </li>
          ))}
          <li><button type="button" className={buttonClasses("ghost", "sm", "text-primary")} onClick={filters.clearAll}>Clear all</button></li>
        </ul>
      )}

      {shield && <div aria-hidden="true" data-testid="filters-click-shield" className="fixed inset-0 z-[60]" onClick={(event) => event.preventDefault()} />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" onMouseDown={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-filter-title"
            className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-sheet bg-surface shadow-sheet md:rounded-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <h2 id="catalog-filter-title" className="text-lg font-bold text-ink">Filters</h2>
              <button type="button" className={buttonClasses("ghost", "sm")} onClick={close}>Close</button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="grid gap-3 md:hidden">
              <ChoiceSelect label="Make" field={filters.make} placeholder="All makes" />
              <ChoiceSelect label="Model" field={filters.model} placeholder={filters.make.value ? "All models" : "Select make first"} disabled={!filters.make.value} />
              <ChoiceSelect label="Location" field={filters.city} placeholder="All Alberta" />
              <PriceRange field={filters.price} />
            </div>

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Basics</h3>
              <RangeInputs minLabel="Year from" maxLabel="Year to" field={filters.year} step={1} />
              <RangeInputs minLabel="Mileage from" maxLabel="Mileage to" field={filters.mileage} step={1} suffix="km" />
              <MultiChecks legend="Body type" field={filters.bodyType} />
              <MultiChecks legend="Fuel" field={filters.fuel} />
              <div className="mt-3">
                <ChoiceSelect label="Transmission" field={filters.transmission} placeholder="Any transmission" />
              </div>
              <MultiChecks legend="Drivetrain" field={filters.drivetrain}>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-primary"
                  checked={filters.awdOr4wd.value}
                  onChange={(event) => filters.awdOr4wd.onChange(event.target.checked)}
                />
                Any AWD/4WD
                </label>
              </MultiChecks>
            </section>

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Engine & performance</h3>
              {!(filters.fuel.value.length === 1 && filters.fuel.value[0] === "Electric") && (
                <RangeInputs minLabel="Engine from (L)" maxLabel="Engine to (L)" field={filters.engine} step={0.1} suffix="L" />
              )}
              <RangeInputs minLabel="Power from (hp)" maxLabel="Power to (hp)" field={filters.power} step={1} suffix="hp" />
            </section>

            <ColorChecks field={filters.color} />

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Additional filters</h3>
              {!showAllFeatures && <MultiChecks legend="Popular features" field={filters.features} options={popularFeatureSlugs.map((slug) => ({ value: slug, label: featureLabels[slug] }))} />}
              {showAllFeatures && featureGroups.map((group) => (
                <MultiChecks
                  key={group.id}
                  legend={group.label}
                  legendClassName="mt-4 text-sm font-semibold text-ink"
                  field={filters.features}
                  options={group.slugs.map((slug) => ({ value: slug, label: featureLabels[slug] }))}
                />
              ))}
              <button type="button" className={buttonClasses("ghost", "sm", "mt-2 text-primary")} aria-expanded={showAllFeatures} onClick={() => setShowAllFeatures((current) => !current)}>
                {showAllFeatures ? "Show less" : `Show all (${filters.features.options.length})`}
              </button>
            </section>
            </div>

            <div className="flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              <button type="button" className={buttonClasses("primary", "lg", "flex-1")} onClick={showResults}>{showLabel}</button>
              <button type="button" className={buttonClasses("secondary", "lg")} onClick={filters.clearAll}>Clear all</button>
            </div>
          </div>

        </div>
      )}
    </section>
  );
}

function ChoiceSelect({ label, field, placeholder, disabled = false }: { label: string; field: ChoiceField; placeholder: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select aria-label={label} value={field.value} disabled={disabled} onChange={(event) => field.onChange(event.target.value)} className="input min-h-11">
        <option value="">{placeholder}</option>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MultiChecks({ legend, field, options, legendClassName = "text-sm font-semibold text-ink", children }: { legend: string; field: MultiChoiceField; options?: FilterOptions; legendClassName?: string; children?: React.ReactNode }) {
  const choices = options ?? field.options;
  return (
    <fieldset className="mt-3">
      <legend className={legendClassName}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((option) => {
          const checked = field.value.includes(option.value);
          return (
            <label key={option.value} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-primary"
                checked={checked}
                onChange={() => field.onChange(checked ? field.value.filter((value) => value !== option.value) : [...field.value, option.value])}
              />
              {option.label}
            </label>
          );
        })}
        {children}
      </div>
    </fieldset>
  );
}

type FilterOptions = MultiChoiceField["options"];

function ColorChecks({ field }: { field: MultiChoiceField }) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-ink">Colour</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {field.options.map((option) => {
          const checked = field.value.includes(option.value);
          const swatch = COLOR_SWATCH[option.value as ExteriorColor];
          return (
            <label key={option.value} className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-primary"
                checked={checked}
                onChange={() => field.onChange(checked ? field.value.filter((value) => value !== option.value) : [...field.value, option.value])}
              />
              <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border border-line-strong ${swatch ?? "border-dashed bg-surface-sunken"}`} />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Typing pauses this long before a range applies on its own (blur and Enter apply at once). */
const RANGE_COMMIT_DELAY_MS = 600;

/**
 * Local draft for a min/max pair. URL updates never overwrite the draft while focus is inside the
 * pair, so committing one field cannot eat keystrokes typed into its sibling. One edit session
 * (focus enters the pair until it leaves) adds one history entry; later commits replace it.
 */
function useRangeDraft(field: RangeField) {
  const [draft, setDraftState] = useState({ min: field.min, max: field.max });
  const draftRef = useRef(draft);
  const fieldRef = useRef(field);
  fieldRef.current = field;
  const editingRef = useRef(false);
  const dirtyRef = useRef(false);
  const pushedRef = useRef(false);
  // Our own commits whose URL echo hasn't arrived yet, oldest first.
  const pendingRef = useRef<{ min: string; max: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setDraft = useCallback((next: { min: string; max: string }) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  useEffect(() => {
    const pending = pendingRef.current;
    const own = pending.findIndex((item) => item.min === field.min && item.max === field.max);
    if (own >= 0) {
      pendingRef.current = pending.slice(own + 1);
      // The echo of an older commit (Min applied on blur, then Max on Enter) must not overwrite
      // a newer value that is still on its way to the URL.
      if (pendingRef.current.length > 0) return;
      // Our latest commit landed: keep the draft while the user is still in the fields.
      if (editingRef.current || dirtyRef.current) return;
    } else {
      // Keep what the user is typing. Anything else (Back/Forward, Clear all, a chip) is an
      // outside change and replaces the draft.
      if (editingRef.current && dirtyRef.current) return;
      pendingRef.current = [];
    }
    dirtyRef.current = false;
    setDraft({ min: field.min, max: field.max });
  }, [field.min, field.max, setDraft]);

  const flush = useCallback((normalizeDraft: boolean, fromTimer = false) => {
    clearTimeout(timerRef.current);
    const current = fieldRef.current;
    // A pause mid-number ("2" on the way to "2015") is not a finished value: wait for more typing.
    const partial = (value: string) => value.trim() !== "" && Number(value) < current.bounds.min;
    if (fromTimer && (partial(draftRef.current.min) || partial(draftRef.current.max))) return;
    const [low, high] = normalizeRangePair(current.bounds, draftRef.current.min, draftRef.current.max);
    if (dirtyRef.current) {
      dirtyRef.current = false;
      const latest = pendingRef.current[pendingRef.current.length - 1] ?? current;
      if (low !== latest.min || high !== latest.max) {
        pendingRef.current = [...pendingRef.current, { min: low, max: high }];
        current.onChange(low, high, pushedRef.current ? "replace" : "push");
        pushedRef.current = true;
      }
    }
    if (normalizeDraft && (low !== draftRef.current.min || high !== draftRef.current.max)) setDraft({ min: low, max: high });
  }, [setDraft]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (dirtyRef.current) flush(false);
  }, [flush]);

  function change(key: "min" | "max", value: string) {
    dirtyRef.current = true;
    setDraft({ ...draftRef.current, [key]: value });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(false, true), RANGE_COMMIT_DELAY_MS);
  }

  const groupProps = {
    onFocus: () => {
      if (editingRef.current) return;
      editingRef.current = true;
      pushedRef.current = false;
    },
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) {
        flush(false);
        return;
      }
      editingRef.current = false;
      flush(true);
    },
  };

  function inputProps(key: "min" | "max") {
    return {
      value: draft[key],
      min: field.bounds.min,
      max: field.bounds.max,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(key, event.target.value),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        flush(true);
      },
    };
  }

  return { groupProps, inputProps };
}

function RangeInputs({ minLabel, maxLabel, field, step, suffix }: { minLabel: string; maxLabel: string; field: RangeField; step: number; suffix?: string }) {
  const { groupProps, inputProps } = useRangeDraft(field);
  return (
    <div className="mt-3 grid grid-cols-2 gap-3" {...groupProps}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{minLabel}</span>
        <AffixedInput suffix={suffix}>
          <input aria-label={minLabel} type="number" inputMode="decimal" step={step} placeholder="Any" {...inputProps("min")} className={`input min-h-11${suffix ? " pr-10" : ""}`} />
        </AffixedInput>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{maxLabel}</span>
        <AffixedInput suffix={suffix}>
          <input aria-label={maxLabel} type="number" inputMode="decimal" step={step} placeholder="Any" {...inputProps("max")} className={`input min-h-11${suffix ? " pr-10" : ""}`} />
        </AffixedInput>
      </label>
    </div>
  );
}

function PriceRange({ field }: { field: RangeField }) {
  const { groupProps, inputProps } = useRangeDraft(field);
  return (
    <div className="grid grid-cols-2 gap-3" {...groupProps}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Minimum price</span>
        <AffixedInput prefix="$">
          <input aria-label="Minimum price" type="number" inputMode="numeric" step={100} placeholder="Min" {...inputProps("min")} className="input min-h-11 pl-7" />
        </AffixedInput>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Maximum price</span>
        <AffixedInput prefix="$">
          <input aria-label="Maximum price" type="number" inputMode="numeric" step={100} placeholder="Max" {...inputProps("max")} className="input min-h-11 pl-7" />
        </AffixedInput>
      </label>
    </div>
  );
}

function AffixedInput({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: React.ReactNode }) {
  if (!prefix && !suffix) return <>{children}</>;
  return (
    <div className="relative">
      {prefix && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-normal text-muted">{prefix}</span>}
      {children}
      {suffix && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">{suffix}</span>}
    </div>
  );
}

function useDialog(open: boolean, onClose: () => void, triggerRef: React.RefObject<HTMLButtonElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>("button,input,select,textarea,summary,a[href]") ?? [])
      .filter((element) => !element.hasAttribute("disabled"));
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);
  return ref;
}
