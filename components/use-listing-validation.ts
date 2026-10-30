"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  firstInvalidField,
  validateListingField,
  type ListingField,
  type ListingFieldContext,
  type ListingFieldErrors,
} from "@/lib/listing-rules";
import { fieldErrorId } from "@/components/ui/field";

type Raw = string | number | null | undefined;

/**
 * Field-level validation for the sell and edit forms, using the shared rules in lib/listing-rules.ts
 * (the same messages the server returns).
 * - blur: show the field's error, including "required" for a field left empty. A blur only happens
 *   after the seller focused the field, so fields they never reached stay quiet until submit.
 * - change: once a field shows an error, re-check as the seller types so the error clears when fixed.
 *   While a pointer is held down (blur from pressing Save, a link, another field) the blur error
 *   waits until the click has fired: showing it at once inserts a line under the field, the button
 *   moves before mouseup, and the click is lost.
 * - submit: show every error and move focus to the first invalid field (scrolled into view).
 */
export function useListingValidation(idFor: Record<ListingField, string>, order?: readonly ListingField[]) {
  const [errors, setErrors] = useState<ListingFieldErrors>({});
  const pointerHeld = useRef(false);
  const deferredBlur = useRef(new Map<ListingField, () => void>());

  const setFieldError = useCallback((field: ListingField, message: string | null) => {
    setErrors((current) => {
      if ((current[field] ?? null) === message) return current;
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    const down = () => { pointerHeld.current = true; };
    // Flush after the click that follows mouseup/pointerup (same task), not before it.
    const up = () => window.setTimeout(() => {
      pointerHeld.current = false;
      const pending = [...deferredBlur.current.values()];
      deferredBlur.current.clear();
      pending.forEach((apply) => apply());
    }, 0);
    const events: [string, () => void][] = [["pointerdown", down], ["mousedown", down], ["pointerup", up], ["mouseup", up], ["pointercancel", up]];
    events.forEach(([name, handler]) => document.addEventListener(name, handler, true));
    return () => events.forEach(([name, handler]) => document.removeEventListener(name, handler, true));
  }, []);

  const onBlur = useCallback((field: ListingField, value: Raw, context?: ListingFieldContext) => {
    const apply = () => setFieldError(field, validateListingField(field, value, context));
    if (pointerHeld.current) deferredBlur.current.set(field, apply);
    else apply();
  }, [setFieldError]);

  const onChange = useCallback((field: ListingField, value: Raw, context?: ListingFieldContext) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const message = validateListingField(field, value, context);
      if (message === current[field]) return current;
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }, []);

  const focusField = useCallback((field: ListingField) => {
    const element = document.getElementById(idFor[field]);
    if (!element) return;
    const details = element.closest("details");
    if (details && !details.open) details.open = true;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // focusVisible so the shared :focus-visible ring shows when Save moves focus here.
    // This project's FocusOptions type omits focusVisible; browsers that support it honor the key.
    element.focus({ preventScroll: true, focusVisible: true } as FocusOptions & { focusVisible: boolean });
    element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [idFor]);

  /** Show all errors; focus the first invalid field. Returns true when the form is valid. */
  const reportAll = useCallback((all: ListingFieldErrors) => {
    deferredBlur.current.clear(); // submit re-checks every field
    setErrors(all);
    const first = firstInvalidField(all, order);
    if (!first) return true;
    // Wait a frame so a field revealed by the error (or an opened <details>) is in the layout.
    window.requestAnimationFrame(() => focusField(first));
    return false;
  }, [focusField, order]);

  /** A server 400 that names a field: show it there and move focus to it. */
  const reportServer = useCallback((field: ListingField, message: string) => {
    setFieldError(field, message);
    window.requestAnimationFrame(() => focusField(field));
  }, [focusField, setFieldError]);

  const describedBy = useCallback((field: ListingField, ...extra: (string | undefined)[]) => {
    const ids = [...extra.filter(Boolean), errors[field] ? fieldErrorId(idFor[field]) : undefined].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  }, [errors, idFor]);

  /** aria-invalid / aria-describedby for a control. Extra ids keep hints in the description. */
  const a11y = useCallback((field: ListingField, ...hintIds: (string | undefined)[]) => ({
    "aria-invalid": errors[field] ? (true as const) : undefined,
    "aria-describedby": describedBy(field, ...hintIds),
  }), [describedBy, errors]);

  const errorCount = Object.keys(errors).length;

  return { errors, errorCount, onBlur, onChange, reportAll, reportServer, a11y, setFieldError };
}
