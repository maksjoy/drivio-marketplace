import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { featureGroups, featureLabel, formatEngineLitres, formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { ListingEditForm } from "@/components/listing-edit-form";
import { EditListingPanel } from "@/components/edit-listing-panel";
import { SITE_URL } from "@/lib/site-url";
import { FavoriteButton } from "@/components/favorite-button";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { ListingGallery } from "@/components/listing-gallery";
import { MessageSellerButton } from "@/components/message-seller-button";

export const revalidate = 0;
type PageContext = { params: Promise<{ id: string }> };

const LISTING_SELECT = "id,seller_name,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,engine_l,power_hp,description,features,status,rejection_reason,created_at,updated_at,sold_at,listing_images(storage_path,thumb_path,position)" as const;
const OWNER_LISTING_SELECT = "id,user_id,seller_name,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,engine_l,power_hp,description,features,status,rejection_reason,created_at,updated_at,sold_at,listing_images(storage_path,thumb_path,position)" as const;

async function getListing(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Anonymous requests must not ask for user_id. That column is revoked from the anon role.
  // The select is chosen at runtime, so the result is read as a loose row.
  // Newer @supabase/supabase-js instantiates both select literals deeply enough to hit TS2589.
  const result = await (supabase as any).from("listings")
    .select(user ? OWNER_LISTING_SELECT : LISTING_SELECT)
    .eq("id", id)
    .single();
  const { data, error } = result as { data: any; error: { message: string } | null };
  if (error || !data) return null;
  const isOwner = Boolean(user && data.user_id === user.id);
  if (!["active", "sold"].includes(data.status) && !isOwner) return null;

  const imageRows = (data.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
  const paths = imageRows.map((image: any) => image.storage_path).filter(Boolean);
  const { data: signed } = paths.length ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600) : { data: [] as { signedUrl: string }[] };
  const images = (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean);

  let isFavorite = false;
  if (user && ["active", "sold"].includes(data.status)) {
    const { data: favorite } = await supabase.from("favorites").select("listing_id").eq("user_id", user.id).eq("listing_id", data.id).maybeSingle();
    isFavorite = Boolean(favorite);
  }
  return { ...data, images, isOwner, signedIn: Boolean(user), isFavorite };
}

export async function generateMetadata(context: PageContext): Promise<Metadata> {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found — Alberta-Cars" };
  const title = `${listing.year} ${listing.make} ${listing.model} — ${formatPriceCAD(listing.price)} | Alberta-Cars`;
  const location = listing.city ? `${listing.city}, Alberta` : "Alberta";
  const text = listing.description?.trim() || "Private used vehicle listing in Alberta.";
  const description = `${formatMileageKm(listing.mileage)} · ${location}. ${text.slice(0, 140)}`;
  const canonical = `${SITE_URL}/listings/${listing.id}`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images: listing.images[0] ? [listing.images[0]] : [] } };
}

export default async function ListingPage(context: PageContext) {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const publicListing = ["active", "sold"].includes(listing.status);
  const vehicleTitle = `${listing.year} ${listing.make} ${listing.model}`;

  return (
    <article className={`grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-6 overflow-x-clip md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 ${listing.status === "active" && !listing.isOwner ? "pb-[calc(9rem+max(0.4rem,env(safe-area-inset-bottom)))] md:pb-0" : ""}`}>
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        <ListingGallery images={listing.images} alt={vehicleTitle} sold={listing.status === "sold"} />
      </div>
      <div className="w-full min-w-0 max-w-full overflow-hidden font-body">
        {!publicListing && <p className="mb-4 inline-block rounded-full bg-line px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">{listing.status === "pending" ? "Pending review — only you can see this" : listing.status}</p>}

        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-line pb-5">
          <div className="min-w-0">
            <h1 className="break-words font-body text-[28px] font-extrabold leading-tight text-ink sm:text-3xl">{vehicleTitle}</h1>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-success sm:text-4xl">{formatPriceCAD(listing.price)}</p>
          </div>
          {publicListing && <div className="flex-none rounded-full bg-surface shadow-sm"><FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} /></div>}
        </div>

        {/* Owner's edit panel sits right under the title and price, so #edit lands near the top
            on a phone instead of after the specs and description. */}
        {listing.isOwner && listing.status !== "sold" && (
          <EditListingPanel>
          <ListingEditForm
            listingId={listing.id}
            initial={{
              make: listing.make,
              model: listing.model,
              year: listing.year,
              price: listing.price,
              mileage: listing.mileage,
              fuel: listing.fuel,
              bodyType: listing.body_type,
              transmission: listing.transmission,
              drivetrain: listing.drivetrain,
              city: listing.city,
              color: listing.color,
              engineL: listing.engine_l,
              powerHp: listing.power_hp,
              features: listing.features ?? [],
              description: listing.description,
            }}
          />
          </EditListingPanel>
        )}

        <div className="divide-y divide-line">
          <PrimarySpec icon="mileage" value={formatMileageKm(listing.mileage)} />
          <PrimarySpec icon="transmission" value={listing.transmission || "Transmission not specified"} />
          <PrimarySpec icon="fuel" value={listing.fuel || "Fuel not specified"} />
          <PrimarySpec icon="location" value={listing.city ? `${listing.city}, Alberta` : "Alberta"} />
        </div>

        <SpecsTable listing={listing} />
        <GroupedOptions features={listing.features ?? []} />

        {listing.description && (
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="font-body text-lg font-extrabold text-ink">Seller description</h2>
            <p className="mt-3 whitespace-pre-line break-words text-[17px] leading-7 text-ink-soft">{listing.description}</p>
          </section>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm font-medium text-muted">{formatPublishedDate(listing.created_at)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ShareButton title={vehicleTitle} />
            {listing.status === "active" && !listing.isOwner && <ReportButton listingId={listing.id} signedIn={listing.signedIn} />}
            {/* Editable listings: "Manage listing" opens the edit panel (#edit); sold ones are managed on /account. */}
            {listing.isOwner && <a href={listing.status !== "sold" ? "#edit" : "/account"} className="rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-bold text-ink hover:bg-surface-sunken">Manage listing</a>}
          </div>
        </div>

        {listing.status === "active" && !listing.isOwner && (
          <section className="mt-6 hidden rounded-2xl border border-line bg-surface p-5 shadow-sm md:block">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-muted">Private seller</p><p className="mt-1 break-words text-lg font-extrabold text-ink">{listing.seller_name || "Alberta-Cars seller"}</p></div>
              <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Contact protected</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">The seller's phone and email are hidden. Start a private Alberta-Cars conversation first; the seller decides if they want to share a phone number.</p>
            <div className="mt-4"><MessageSellerButton listingId={listing.id} signedIn={listing.signedIn} /></div>
          </section>
        )}
      </div>

      {listing.status === "active" && !listing.isOwner && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+max(0.4rem,env(safe-area-inset-bottom)))] z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <MessageSellerButton listingId={listing.id} signedIn={listing.signedIn} mobile />
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border border-line-strong bg-surface"><FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} compact /></div>
          </div>
        </div>
      )}
    </article>
  );
}

function PrimarySpec({ icon, value }: { icon: "mileage" | "fuel" | "transmission" | "location"; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-4 py-4 text-[17px] text-ink">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-sunken text-ink" aria-hidden="true">
        {icon === "mileage" && <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 16a7 7 0 1 1 14 0" /><path d="m12 13 4-4" /><path d="M4 16h16" /></svg>}
        {icon === "fuel" && <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 21V4h8v17" /><path d="M5 21h10" /><path d="M8 7h4" /><path d="M14 9h2l2 2v6a2 2 0 0 0 4 0v-6l-2-2" /></svg>}
        {icon === "transmission" && <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="6" r="2" /><circle cx="17" cy="6" r="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M7 8v8M17 8v8M7 12h10" /></svg>}
        {icon === "location" && <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>}
      </span>
      <span className="min-w-0 break-words font-semibold">{value}</span>
    </div>
  );
}

function SpecsTable({ listing }: { listing: { engine_l?: number | string | null; engine?: string | null; power_hp?: number | null; transmission?: string | null; drivetrain?: string | null; body_type?: string | null; color?: string | null } }) {
  const rows: Array<[string, string]> = [];
  const engine = engineDisplay(listing.engine_l, listing.engine);
  if (engine) rows.push(["Engine", engine]);
  if (listing.power_hp) rows.push(["Power", `${listing.power_hp} hp`]);
  if (listing.transmission) rows.push(["Transmission", listing.transmission]);
  if (listing.drivetrain) rows.push(["Drivetrain", listing.drivetrain]);
  if (listing.body_type) rows.push(["Body", listing.body_type]);
  if (listing.color) rows.push(["Colour", listing.color]);
  if (!rows.length) return null;
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h2 className="font-body text-lg font-extrabold text-ink">Specifications</h2>
      <dl className="mt-3 divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd className="break-words font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function engineDisplay(engineL: number | string | null | undefined, engine: string | null | undefined) {
  const fromColumn = formatEngineLitres(engineL);
  if (fromColumn) return fromColumn;
  if (!engine?.trim()) return null;
  const text = engine.trim();
  if (/l\s*$/i.test(text)) return text.replace(/\s*l\s*$/i, " L");
  return formatEngineLitres(text) ?? text;
}

function GroupedOptions({ features }: { features: string[] }) {
  const present = new Set(features);
  const groups = featureGroups.flatMap((group) => {
    const items = group.slugs.flatMap((slug) => {
      if (!present.has(slug)) return [];
      const label = featureLabel(slug);
      return label ? [label] : [];
    });
    return items.length ? [{ id: group.id, label: group.label, items }] : [];
  });
  if (!groups.length) return null;
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h2 className="font-body text-lg font-extrabold text-ink">Options</h2>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{group.label}</h3>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {group.items.map((label) => <li key={label} className="flex items-start gap-2 text-sm text-ink"><svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5 9-10"/></svg>{label}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatPublishedDate(value?: string | null) {
  if (!value) return "Recently published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Published today";
  if (days === 1) return "Published yesterday";
  if (days < 7) return `Published ${days} days ago`;
  return `Published ${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
}
