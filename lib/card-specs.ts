import { formatEngineDisplacement, formatMileageKm } from "./listings";

export const CARD_SPEC_LIMIT = 3;

type CardSpecSource = {
  mileage: number;
  transmission?: string | null;
  drivetrain?: string | null;
  fuel?: string | null;
  engine?: string | null;
};

/**
 * Specs on a home listing card, in the approved order: mileage, transmission, drivetrain.
 * Electric cars show "Electric" instead of the transmission. A missing spec is
 * backfilled with fuel, then engine size. At most three, never blanks or duplicates.
 */
export function cardSpecs(listing: CardSpecSource): string[] {
  const electric = listing.fuel?.trim().toLowerCase() === "electric";
  const primary = [
    formatMileageKm(listing.mileage),
    electric ? "Electric" : listing.transmission,
    listing.drivetrain,
  ];
  const fallbacks = [electric ? null : listing.fuel, formatEngineDisplacement(listing.engine)];
  const specs: string[] = [];
  for (const value of [...primary, ...fallbacks]) {
    const text = value?.trim();
    if (text && !specs.includes(text)) specs.push(text);
    if (specs.length === CARD_SPEC_LIMIT) break;
  }
  return specs;
}
