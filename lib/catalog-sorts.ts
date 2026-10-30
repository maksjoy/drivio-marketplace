// Zod-free so client bundles can import it (Zod's eval probe trips the CSP).
export const CATALOG_SORTS = ["recent", "price_asc", "price_desc", "year_desc", "year_asc", "mileage_asc", "mileage_desc"] as const;
