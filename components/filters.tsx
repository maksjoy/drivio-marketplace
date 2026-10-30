"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLOR_SWATCH, featureGroups, featureLabels, popularFeatureSlugs, type ExteriorColor } from "@/lib/listings";
import { buttonClasses } from "@/components/ui/button";
import { useCatalogFilters, type ChoiceField, type MultiChoiceField, type RangeField } from "@/components/catalog-filter-state";

const PRICE_MANUAL_MAX = 2000000;

export function Filters({ resultCount }: { resultCount: number | null }) {
  const filters = useCatalogFilters();
  const [open, setOpen] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const dialogRef = useDialog(open, close, triggerRef);
  const showLabel = resultCount === null
    ? "Show cars"
    : `Show ${new Intl.NumberFormat("en-CA").format(resultCount)} cars`;

  function showResults() {
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
              <RangeInputs minLabel="Year from" maxLabel="Year to" field={filters.year} min={1980} max={2100} step={1} />
              <RangeInputs minLabel="Mileage from" maxLabel="Mileage to" field={filters.mileage} min={0} max={2000000} step={1} suffix="km" />
              <MultiChecks legend="Body type" field={filters.bodyType} />
              <MultiChecks legend="Fuel" field={filters.fuel} />
              <div className="mt-3">
                <ChoiceSelect label="Transmission" field={filters.transmission} placeholder="Any transmission" />
              </div>
              <MultiChecks legend="Drivetrain" field={filters.drivetrain} />
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-primary"
                  checked={filters.awdOr4wd.value}
                  onChange={(event) => filters.awdOr4wd.onChange(event.target.checked)}
                />
                AWD/4WD
                </label>
              </div>
            </section>

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Engine & performance</h3>
              {!(filters.fuel.value.length === 1 && filters.fuel.value[0] === "Electric") && (
                <RangeInputs minLabel="Engine from (L)" maxLabel="Engine to (L)" field={filters.engine} min={0.6} max={8.5} step={0.1} suffix="L" />
              )}
              <RangeInputs minLabel="Power from (hp)" maxLabel="Power to (hp)" field={filters.power} min={40} max={1500} step={1} suffix="hp" />
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

function MultiChecks({ legend, field, options, legendClassName = "text-sm font-semibold text-ink" }: { legend: string; field: MultiChoiceField; options?: FilterOptions; legendClassName?: string }) {
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
              <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border border-line-strong${swatch ? "" : " bg-surface-sunken"}`} style={swatch ? { backgroundColor: swatch } : undefined} />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeInputs({ minLabel, maxLabel, field, min, max, step, suffix }: { minLabel: string; maxLabel: string; field: RangeField; min: number; max: number; step: number; suffix?: string }) {
  const [minDraft, setMinDraft] = useState(field.min);
  const [maxDraft, setMaxDraft] = useState(field.max);
  useEffect(() => {
    setMinDraft(field.min);
    setMaxDraft(field.max);
  }, [field.min, field.max]);

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{minLabel}</span>
        <AffixedInput suffix={suffix}>
          <input aria-label={minLabel} type="number" inputMode="decimal" min={min} max={max} step={step} placeholder="Any" value={minDraft} onChange={(event) => setMinDraft(event.target.value)} onBlur={() => field.onChange(minDraft, maxDraft)} className={`input min-h-11${suffix ? " pr-10" : ""}`} />
        </AffixedInput>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{maxLabel}</span>
        <AffixedInput suffix={suffix}>
          <input aria-label={maxLabel} type="number" inputMode="decimal" min={min} max={max} step={step} placeholder="Any" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} onBlur={() => field.onChange(minDraft, maxDraft)} className={`input min-h-11${suffix ? " pr-10" : ""}`} />
        </AffixedInput>
      </label>
    </div>
  );
}

function PriceRange({ field }: { field: RangeField }) {
  const [minDraft, setMinDraft] = useState(field.min);
  const [maxDraft, setMaxDraft] = useState(field.max);
  useEffect(() => {
    setMinDraft(field.min);
    setMaxDraft(field.max);
  }, [field.min, field.max]);

  function commit() {
    const minNumber = Math.max(0, Number(minDraft) || 0);
    const maxNumber = Math.max(0, Number(maxDraft) || 0);
    const safeMin = minNumber ? String(Math.min(minNumber, PRICE_MANUAL_MAX)) : "";
    const safeMax = maxNumber ? String(Math.min(maxNumber, PRICE_MANUAL_MAX)) : "";
    if (safeMin && safeMax && Number(safeMin) > Number(safeMax)) {
      setMaxDraft(safeMin);
      field.onChange(safeMin, safeMin);
      return;
    }
    setMinDraft(safeMin);
    setMaxDraft(safeMax);
    field.onChange(safeMin, safeMax);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Minimum price</span>
        <AffixedInput prefix="$">
          <input aria-label="Minimum price" type="number" inputMode="numeric" min={0} max={PRICE_MANUAL_MAX} step={100} placeholder="Min" value={minDraft} onChange={(event) => setMinDraft(event.target.value)} onBlur={commit} className="input min-h-11 pl-7" />
        </AffixedInput>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Maximum price</span>
        <AffixedInput prefix="$">
          <input aria-label="Maximum price" type="number" inputMode="numeric" min={0} max={PRICE_MANUAL_MAX} step={100} placeholder="Max" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} onBlur={commit} className="input min-h-11 pl-7" />
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
