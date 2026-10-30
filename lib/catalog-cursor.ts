import { z } from "zod";

export const sortSchema = z.enum(["recent", "price_asc", "price_desc", "year_desc", "year_asc", "mileage_asc"]);
export type CatalogSort = z.infer<typeof sortSchema>;

const ISO_TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_CURSOR_LENGTH = 512;

const timestamptzSchema = z.string().regex(ISO_TIMESTAMPTZ).refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 60) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}, "Invalid cursor time");

const idSchema = z.string().uuid();
const priceSchema = z.number().int().min(0).max(2_000_000);
const yearSchema = z.number().int().min(1980).max(2100);
const mileageSchema = z.number().int().min(0).max(2_000_000);

export const cursorSchema = z.discriminatedUnion("sort", [
  z.object({ sort: z.literal("recent"), value: timestamptzSchema, id: idSchema }),
  z.object({ sort: z.literal("price_asc"), value: priceSchema, id: idSchema }),
  z.object({ sort: z.literal("price_desc"), value: priceSchema, id: idSchema }),
  z.object({ sort: z.literal("year_desc"), value: yearSchema, id: idSchema }),
  z.object({ sort: z.literal("year_asc"), value: yearSchema, id: idSchema }),
  z.object({ sort: z.literal("mileage_asc"), value: mileageSchema, id: idSchema }),
]);

export type CatalogCursor = z.infer<typeof cursorSchema>;

const SORT_FILTER = {
  recent: { column: "created_at", direction: "lt" },
  price_asc: { column: "price", direction: "gt" },
  price_desc: { column: "price", direction: "lt" },
  year_desc: { column: "year", direction: "lt" },
  year_asc: { column: "year", direction: "gt" },
  mileage_asc: { column: "mileage", direction: "gt" },
} as const;

function quoteFilterValue(value: string) {
  // Validated cursors cannot contain filter metacharacters. Quoting keeps
  // reserved timestamp characters (".", ":") inside a single PostgREST value.
  if (/["\\,()]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Refusing to interpolate an unsafe cursor value");
  }
  return `"${value}"`;
}

export function cursorFilter(cursor: CatalogCursor) {
  const { column, direction } = SORT_FILTER[cursor.sort];
  const value = quoteFilterValue(String(cursor.value));
  const id = quoteFilterValue(cursor.id);
  return `${column}.${direction}.${value},and(${column}.eq.${value},id.${direction}.${id})`;
}

export function decodeCursor(raw: string | null, sort: CatalogSort): CatalogCursor | null {
  if (!raw || raw.length > MAX_CURSOR_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const result = cursorSchema.safeParse(parsed);
    if (!result.success || result.data.sort !== sort) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function encodeCursor(sort: CatalogSort, row: {
  id?: unknown;
  price?: unknown;
  year?: unknown;
  mileage?: unknown;
  created_at?: unknown;
}) {
  const value = sort.startsWith("price") ? Number(row.price)
    : sort.startsWith("year") ? Number(row.year)
      : sort === "mileage_asc" ? Number(row.mileage)
        : String(row.created_at ?? "");
  const result = cursorSchema.safeParse({ sort, value, id: row.id });
  if (!result.success) return null;
  return Buffer.from(JSON.stringify(result.data), "utf8").toString("base64url");
}

export function applyCursor<T extends { or: (filters: string) => T }>(query: T, cursor: CatalogCursor) {
  return query.or(cursorFilter(cursor));
}
