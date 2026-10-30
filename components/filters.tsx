"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { featureGroups, featureLabels, popularFeatureSlugs } from "@/lib/listings";
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
    <section aria-label="Vehicle search filters" className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-body text-xl font-extrabold text-ink">Search cars</h2>
        {filters.activeCount > 0 && <button type="button" onClick={filters.clearAll} className={buttonClasses("ghost", "sm", "text-primary underline underline-offset-4")}>Clear all</button>}
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2">
        <ChoiceSelect label="Make" field={filters.make} placeholder="All makes" />
        <ChoiceSelect label="Model" field={filters.model} placeholder={filters.make.value ? "All models" : "Select make first"} disabled={!filters.make.value} />
        <ChoiceSelect label="Location" field={filters.city} placeholder="All Alberta" />
        <PriceRange field={filters.price} />
      </div>

      <button
        ref={triggerRef}
        type="button"
        className={buttonClasses("secondary", "md", "mt-3")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {`Filters (${filters.activeCount})`}
      </button>

      {filters.chips.length > 0 && (
        <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
          {filters.chips.map((chip) => (
            <li key={chip.id}>
              <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary-strong hover:bg-primary-muted" onClick={chip.onRemove}>{chip.label} ×</button>
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
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-sheet bg-surface p-4 shadow-sheet md:rounded-sheet sm:p-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="catalog-filter-title" className="text-lg font-bold text-ink">Filters</h2>
              <button type="button" className={buttonClasses("ghost", "sm")} onClick={close}>Close</button>
            </div>

            <div className="grid gap-3 md:hidden">
              <ChoiceSelect label="Make" field={filters.make} placeholder="All makes" />
              <ChoiceSelect label="Model" field={filters.model} placeholder={filters.make.value ? "All models" : "Select make first"} disabled={!filters.make.value} />
              <ChoiceSelect label="Location" field={filters.city} placeholder="All Alberta" />
              <PriceRange field={filters.price} />
            </div>

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Basics</h3>
              <RangeInputs minLabel="Year from" maxLabel="Year to" field={filters.year} min={1980} max={2100} step={1} />
              <RangeInputs minLabel="Mileage from" maxLabel="Mileage to" field={filters.mileage} min={0} max={2000000} step={1} />
              <MultiChecks legend="Body type" field={filters.bodyType} />
              <MultiChecks legend="Fuel" field={filters.fuel} />
              <ChoiceSelect label="Transmission" field={filters.transmission} placeholder="Any transmission" />
              <MultiChecks legend="Drivetrain" field={filters.drivetrain} />
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-primary"
                  checked={filters.awdOr4wd.value}
                  onChange={(event) => filters.awdOr4wd.onChange(event.target.checked)}
                />
                AWD/4WD
              </label>
            </section>

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Engine & performance</h3>
              <RangeInputs minLabel="Engine from (L)" maxLabel="Engine to (L)" field={filters.engine} min={0.6} max={8.5} step={0.1} />
              <RangeInputs minLabel="Power from (hp)" maxLabel="Power to (hp)" field={filters.power} min={40} max={1500} step={1} />
            </section>

            <ColorChecks field={filters.color} />

            <section className="mt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Additional filters</h3>
              {!showAllFeatures && <MultiChecks legend="Popular features" field={filters.features} options={popularFeatureSlugs.map((slug) => ({ value: slug, label: featureLabels[slug] }))} />}
              <button type="button" className={buttonClasses("ghost", "sm", "mt-2 text-primary")} aria-expanded={showAllFeatures} onClick={() => setShowAllFeatures((current) => !current)}>
                {showAllFeatures ? "Show less" : `Show all (${filters.features.options.length})`}
              </button>
              {showAllFeatures && featureGroups.map((group) => (
                <details key={group.id}>
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">{group.label}</summary>
                  <MultiChecks
                    legend={group.label}
                    field={filters.features}
                    options={group.slugs.map((slug) => ({ value: slug, label: featureLabels[slug] }))}
                  />
                </details>
              ))}
            </section>

            <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-line bg-surface py-3">
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

function MultiChecks({ legend, field, options }: { legend: string; field: MultiChoiceField; options?: FilterOptions }) {
  const choices = options ?? field.options;
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
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
          const light = option.value === "White" || option.value === "Silver";
          return (
            <label key={option.value} className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-control border bg-surface px-3 text-sm text-ink has-[:checked]:bg-primary-soft ${light ? "border-2 border-ink" : "border-line-strong"}`}>
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-primary"
                checked={checked}
                onChange={() => field.onChange(checked ? field.value.filter((value) => value !== option.value) : [...field.value, option.value])}
              />
              <span>{option.label}</span>
              {checked ? <span aria-hidden="true">✓</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeInputs({ minLabel, maxLabel, field, min, max, step }: { minLabel: string; maxLabel: string; field: RangeField; min: number; max: number; step: number }) {
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
        <input aria-label={minLabel} type="number" inputMode="decimal" min={min} max={max} step={step} value={minDraft} onChange={(event) => setMinDraft(event.target.value)} onBlur={() => field.onChange(minDraft, maxDraft)} className="input min-h-11" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{maxLabel}</span>
        <input aria-label={maxLabel} type="number" inputMode="decimal" min={min} max={max} step={step} value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} onBlur={() => field.onChange(minDraft, maxDraft)} className="input min-h-11" />
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
        <input aria-label="Minimum price" type="number" inputMode="numeric" min={0} max={PRICE_MANUAL_MAX} step={100} placeholder="Min" value={minDraft} onChange={(event) => setMinDraft(event.target.value)} onBlur={commit} className="input min-h-11" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Maximum price</span>
        <input aria-label="Maximum price" type="number" inputMode="numeric" min={0} max={PRICE_MANUAL_MAX} step={100} placeholder="Max" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} onBlur={commit} className="input min-h-11" />
      </label>
    </div>
  );
}

function useDialog(open: boolean, onClose: () => void, triggerRef: React.RefObject<HTMLButtonElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
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
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);
  return ref;
}
