import type { ListingStatus } from "@/lib/listings";

/**
 * Columns the edit page reads. There is no generated supabase types file in this
 * repo; this is the same public.listings / listing_images shape the query selects.
 */
type ListingImageRelationship = {
  foreignKeyName: "listing_images_listing_id_fkey";
  columns: ["listing_id"];
  isOneToOne: false;
  referencedRelation: "listings";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      listings: {
        Row: {
          id: string;
          user_id: string;
          make: string;
          model: string;
          year: number;
          price: number;
          mileage: number;
          body_type: string | null;
          transmission: string | null;
          fuel: string;
          drivetrain: string | null;
          city: string | null;
          color: string | null;
          engine_l: number | null;
          power_hp: number | null;
          description: string | null;
          features: string[];
          status: ListingStatus;
          created_at: string;
          sold_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      listing_images: {
        Row: {
          listing_id: string;
          storage_path: string;
          position: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [ListingImageRelationship];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
