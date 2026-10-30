export type ListingStatus = "pending" | "active" | "sold" | "removed" | "rejected";

export type Listing = {
  id: string;
  userId: string;
  sellerName: string;
  sellerPhone: string | null;
  sellerEmail: string | null;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  bodyType: string | null;
  transmission: string | null;
  fuel: string;
  drivetrain: string | null;
  city: string | null;
  color: string | null;
  engine: string | null;
  description: string | null;
  features: string[];
  status: ListingStatus;
  images: string[];
  createdAt: string;
};

export const albertaCities = [
  "Calgary","Edmonton","Red Deer","Lethbridge","Airdrie",
  "Banff","Beaumont","Blackfalds","Bonnyville","Brooks","Camrose","Canmore","Chestermere","Coaldale","Cochrane","Cold Lake","Devon","Drayton Valley","Edson","Fort McMurray","Fort Saskatchewan","Grande Prairie","High River","Hinton","Innisfail","Lacombe","Leduc","Lloydminster","Medicine Hat","Morinville","Okotoks","Olds","Peace River","Ponoka","Rocky Mountain House","Sherwood Park","Slave Lake","Spruce Grove","St. Albert","Stony Plain","Strathmore","Sylvan Lake","Taber","Wainwright","Wetaskiwin","Whitecourt"
] as const;

export const bodyTypes = [
  "Sedan","SUV","Truck/Pickup","Hatchback","Coupe","Wagon","Van/Minivan","Convertible"
] as const;

export const transmissions = ["Automatic", "Manual", "CVT"] as const;
export const fuelTypes = ["Gasoline", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric"] as const;
export const drivetrains = ["FWD", "RWD", "AWD", "4WD"] as const;

export const vehicleColors = [
  "Black", "White", "Silver", "Grey", "Red", "Blue", "Green", "Brown", "Beige", "Gold", "Orange", "Yellow", "Purple", "Other"
] as const;

export const engineDisplacements = Array.from(
  { length: 96 },
  (_, index) => ((5 + index) / 10).toFixed(1),
);

export const vehicleMakesAndModels = {
  Acura: ["Integra","ILX","TL","TLX","TSX","RDX","MDX","ZDX"],
  "Alfa Romeo": ["Giulia","Stelvio","Tonale","4C"],
  "Aston Martin": ["Vantage","DB11","DB12","DBX"],
  Audi: ["A3","A4","A5","A6","A7","A8","S3","S4","S5","Q3","Q4 e-tron","Q5","Q7","Q8","e-tron","RS 3","RS 5","RS 6"],
  Bentley: ["Bentayga","Continental GT","Flying Spur"],
  BMW: ["2 Series","3 Series","4 Series","5 Series","7 Series","8 Series","X1","X2","X3","X4","X5","X6","X7","Z4","i3","i4","i5","i7","iX"],
  Buick: ["Encore","Encore GX","Envision","Enclave","Regal","LaCrosse"],
  Cadillac: ["ATS","CTS","CT4","CT5","XT4","XT5","XT6","Escalade","Lyriq"],
  Chevrolet: ["Cruze","Malibu","Impala","Trax","Trailblazer","Equinox","Blazer","Traverse","Tahoe","Suburban","Colorado","Silverado 1500","Silverado 2500HD","Camaro","Corvette","Bolt EV","Bolt EUV"],
  Chrysler: ["200","300","Pacifica","Town & Country"],
  Dodge: ["Dart","Challenger","Charger","Journey","Durango","Grand Caravan","Hornet"],
  Ferrari: ["Roma","Portofino","California","488","F8 Tributo","296 GTB","SF90"],
  Fiat: ["500","500X","500L","124 Spider"],
  Ford: ["Fiesta","Focus","Fusion","Escape","Edge","Explorer","Expedition","Bronco","Bronco Sport","EcoSport","Maverick","Ranger","F-150","F-150 Lightning","F-250","F-350","Mustang","Mustang Mach-E","Transit"],
  Genesis: ["G70","G80","G90","GV60","GV70","GV80"],
  GMC: ["Terrain","Acadia","Yukon","Yukon XL","Canyon","Sierra 1500","Sierra 2500HD","Sierra 3500HD","Hummer EV"],
  Honda: ["Fit","Civic","Accord","Insight","HR-V","CR-V","Passport","Pilot","Ridgeline","Odyssey"],
  Hummer: ["H2","H3"],
  Hyundai: ["Accent","Elantra","Sonata","Venue","Kona","Tucson","Santa Fe","Palisade","Santa Cruz","Ioniq","Ioniq 5","Ioniq 6"],
  Infiniti: ["Q50","Q60","QX30","QX50","QX55","QX60","QX80"],
  Jaguar: ["XE","XF","XJ","F-Type","F-Pace","E-Pace","I-Pace"],
  Jeep: ["Renegade","Compass","Cherokee","Grand Cherokee","Wrangler","Gladiator","Wagoneer","Grand Wagoneer"],
  Kia: ["Rio","Forte","K4","K5","Soul","Niro","Seltos","Sportage","Sorento","Telluride","Carnival","Stinger","EV6","EV9"],
  Lamborghini: ["Huracan","Aventador","Urus","Revuelto"],
  "Land Rover": ["Discovery Sport","Discovery","Defender","Range Rover Evoque","Range Rover Velar","Range Rover Sport","Range Rover"],
  Lexus: ["IS","ES","GS","LS","RC","LC","UX","NX","RX","GX","LX","RZ"],
  Lincoln: ["MKC","MKX","Corsair","Nautilus","Aviator","Navigator"],
  Lucid: ["Air","Gravity"],
  Maserati: ["Ghibli","Quattroporte","Levante","Grecale","GranTurismo"],
  Mazda: ["Mazda2","Mazda3","Mazda6","CX-3","CX-30","CX-5","CX-50","CX-70","CX-9","CX-90","MX-5"],
  "Mercedes-Benz": ["A-Class","B-Class","C-Class","E-Class","S-Class","CLA","CLS","GLA","GLB","GLC","GLE","GLS","G-Class","AMG GT","EQA","EQB","EQE","EQS"],
  MINI: ["Cooper","Cooper S","Clubman","Countryman"],
  Mitsubishi: ["Lancer","Mirage","RVR","Eclipse Cross","Outlander","Outlander PHEV"],
  Nissan: ["Micra","Versa","Sentra","Altima","Maxima","Kicks","Qashqai","Rogue","Murano","Pathfinder","Armada","Frontier","Titan","370Z","Z","Leaf","Ariya"],
  Polestar: ["Polestar 2","Polestar 3","Polestar 4"],
  Pontiac: ["G5","G6","Grand Prix","Vibe","Solstice"],
  Porsche: ["718 Boxster","718 Cayman","911","Panamera","Macan","Cayenne","Taycan"],
  Ram: ["1500","1500 Classic","2500","3500","ProMaster","ProMaster City"],
  Rivian: ["R1T","R1S"],
  "Rolls-Royce": ["Ghost","Phantom","Cullinan","Wraith"],
  Saab: ["9-3","9-5","9-7X"],
  Saturn: ["Astra","Aura","Ion","Outlook","Vue"],
  Scion: ["FR-S","iM","tC","xB","xD"],
  smart: ["fortwo"],
  Subaru: ["Impreza","Legacy","WRX","Crosstrek","Forester","Outback","Ascent","BRZ","Solterra"],
  Suzuki: ["Grand Vitara","Kizashi","SX4","Swift"],
  Tesla: ["Model 3","Model Y","Model S","Model X","Cybertruck"],
  Toyota: ["Yaris","Corolla","Camry","Avalon","Prius","Crown","Corolla Cross","C-HR","RAV4","Venza","Highlander","Grand Highlander","4Runner","Land Cruiser","Sequoia","Tacoma","Tundra","Sienna","GR86","Supra","bZ4X"],
  Volkswagen: ["Jetta","Passat","Arteon","Golf","Golf GTI","Golf R","Taos","Tiguan","Atlas","Atlas Cross Sport","ID.4","ID. Buzz"],
  Volvo: ["S60","S90","V60","V90","XC40","XC60","XC90","C40 Recharge","EX30","EX90"]
} as const;

export type VehicleMake = keyof typeof vehicleMakesAndModels;
export const vehicleMakes = Object.keys(vehicleMakesAndModels) as VehicleMake[];

export const COLORS = [
  "Black","White","Silver","Grey","Blue","Red","Green","Brown","Beige","Gold","Orange","Yellow","Purple","Other",
] as const;

export type ExteriorColor = (typeof COLORS)[number];

/**
 * Swatch classes for the catalog colour filter. Literal Tailwind classes (not
 * inline styles) because the CSP is style-src 'self' and blocks style="".
 * "Other" has no colour: neutral bg-surface-sunken with a dashed border.
 */
export const COLOR_SWATCH: Record<ExteriorColor, string> = {
  Black: "bg-[#111827]",
  White: "bg-[#ffffff]",
  Silver: "bg-[#c0c4c8]",
  Grey: "bg-[#6b7280]",
  Blue: "bg-[#1d4ed8]",
  Red: "bg-[#b91c1c]",
  Green: "bg-[#15803d]",
  Brown: "bg-[#78350f]",
  Beige: "bg-[#d6c7a1]",
  Gold: "bg-[#c9a227]",
  Orange: "bg-[#ea580c]",
  Yellow: "bg-[#facc15]",
  Purple: "bg-[#7e22ce]",
  Other: "border-dashed bg-surface-sunken",
};

/** Stable feature codes. Cardinality cap in the database matches this list. */
export const FEATURE_SLUGS = [
  "leather_seats","heated_seats","heated_rear_seats","ventilated_seats","heated_steering_wheel",
  "panoramic_roof","sunroof","keyless_entry","push_button_start","power_liftgate","third_row",
  "remote_start","block_heater","winter_tires","tow_package",
  "navigation","carplay_android_auto","bluetooth","premium_audio","head_up_display",
  "backup_camera","camera_360","parking_sensors","blind_spot","lane_keep_assist","cruise_control","adaptive_cruise",
  "carfax_available",
] as const;

export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

export const FEATURE_CARDINALITY_CAP = FEATURE_SLUGS.length;

export const featureLabels: Record<FeatureSlug, string> = {
  leather_seats: "Leather interior",
  heated_seats: "Heated seats",
  heated_rear_seats: "Heated rear seats",
  ventilated_seats: "Ventilated seats",
  heated_steering_wheel: "Heated steering wheel",
  panoramic_roof: "Panoramic roof",
  sunroof: "Sunroof",
  keyless_entry: "Keyless entry",
  push_button_start: "Push-button start",
  power_liftgate: "Power liftgate",
  third_row: "Third row",
  remote_start: "Remote start",
  block_heater: "Block heater",
  winter_tires: "Winter tires included",
  tow_package: "Tow package",
  navigation: "Navigation",
  carplay_android_auto: "Apple CarPlay / Android Auto",
  bluetooth: "Bluetooth",
  premium_audio: "Premium audio",
  head_up_display: "Head-up display",
  backup_camera: "Backup camera",
  camera_360: "360° camera",
  parking_sensors: "Parking sensors",
  blind_spot: "Blind spot monitoring",
  lane_keep_assist: "Lane keep assist",
  cruise_control: "Cruise control",
  adaptive_cruise: "Adaptive cruise control",
  carfax_available: "CARFAX / CarProof available",
};

export const featureGroups = [
  {
    id: "comfort",
    label: "Comfort",
    slugs: ["leather_seats","panoramic_roof","sunroof","heated_seats","heated_rear_seats","ventilated_seats","keyless_entry","push_button_start"],
  },
  {
    id: "safety",
    label: "Safety",
    slugs: ["backup_camera","camera_360","parking_sensors","blind_spot","lane_keep_assist","cruise_control","adaptive_cruise"],
  },
  {
    id: "tech",
    label: "Tech",
    slugs: ["navigation","carplay_android_auto","bluetooth","premium_audio","head_up_display"],
  },
  {
    id: "winter",
    label: "Winter & Utility",
    slugs: ["remote_start","block_heater","heated_steering_wheel","winter_tires","tow_package","power_liftgate","third_row","carfax_available"],
  },
] as const satisfies readonly { id: string; label: string; slugs: readonly FeatureSlug[] }[];

/** Leather and panoramic roof lead. The filter sheet shows these before "Show all". */
export const popularFeatureSlugs = [
  "leather_seats","panoramic_roof","heated_seats","remote_start","backup_camera","carplay_android_auto",
] as const satisfies readonly FeatureSlug[];

const featureBadgeOrder: readonly FeatureSlug[] = ["leather_seats","panoramic_roof", ...FEATURE_SLUGS];

export function featureLabel(slug: string) {
  return slug in featureLabels ? featureLabels[slug as FeatureSlug] : null;
}

export function featureBadgeLabels(features: readonly string[] | null | undefined, limit = 2) {
  const present = new Set(features ?? []);
  const labels: string[] = [];
  for (const slug of featureBadgeOrder) {
    if (!present.has(slug)) continue;
    const label = featureLabels[slug];
    if (!labels.includes(label)) labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}

export function formatEngineLitres(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return `${parsed.toFixed(1)} L`;
}

export function engineLitreOptions() {
  const options: string[] = [];
  for (let step = 6; step <= 85; step += 1) options.push((step / 10).toFixed(1));
  return options;
}

export const MAX_ACTIVE_LISTINGS_PER_USER = 3;
export const DEALER_REPORT_THRESHOLD = 3;

export function parseOptionalInt(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

export const formatPriceCAD = (price: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(price);

export const formatMileageKm = (mileage: number) =>
  `${new Intl.NumberFormat("en-CA").format(mileage)} km`;

export const formatEngineDisplacement = (engine: string | null | undefined) => {
  const normalized = engine?.trim().replace(/(?:\s*L)+$/i, "").trim();
  return normalized ? `${normalized} L` : "";
};
