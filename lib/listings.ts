export type ListingStatus = "pending" | "active" | "sold" | "removed" | "rejected";

export type Listing = {
  id: string;
  userId: string;
  sellerName: string;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerTelegram: string | null;
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
  "Calgary",
  "Edmonton",
  "Red Deer",
  "Lethbridge",
  "St. Albert",
  "Medicine Hat",
  "Grande Prairie",
  "Airdrie",
  "Spruce Grove",
  "Leduc",
  "Fort McMurray",
  "Wabasca",
  "Cold Lake",
  "Okotoks",
  "Cochrane",
  "Lloydminster",
  "Camrose",
  "Canmore",
] as const;

export const bodyTypes = [
  "Sedan",
  "SUV",
  "Pickup",
  "Hatchback",
  "Coupe",
  "Wagon",
  "Van/Minivan",
  "Convertible",
] as const;

export const transmissions = ["Automatic", "Manual", "CVT"] as const;
export const fuelTypes = ["Gasoline", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric"] as const;
export const drivetrains = ["FWD", "RWD", "AWD", "4WD"] as const;

export const vehicleMakesAndModels = {
  Acura: ["Integra", "TLX", "RDX", "MDX"],
  Audi: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "e-tron"],
  BMW: ["2 Series", "3 Series", "4 Series", "5 Series", "X1", "X3", "X5", "X7", "i4", "iX"],
  Buick: ["Encore", "Encore GX", "Envision", "Enclave"],
  Cadillac: ["CT4", "CT5", "XT4", "XT5", "XT6", "Escalade"],
  Chevrolet: ["Malibu", "Trax", "Trailblazer", "Equinox", "Blazer", "Traverse", "Tahoe", "Suburban", "Colorado", "Silverado 1500", "Bolt EV"],
  Chrysler: ["300", "Pacifica"],
  Dodge: ["Challenger", "Charger", "Durango", "Grand Caravan", "Hornet"],
  Ford: ["Escape", "Edge", "Explorer", "Expedition", "Bronco", "Bronco Sport", "Maverick", "Ranger", "F-150", "Mustang", "Mustang Mach-E"],
  Genesis: ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
  GMC: ["Terrain", "Acadia", "Yukon", "Canyon", "Sierra 1500", "Sierra 2500HD"],
  Honda: ["Civic", "Accord", "HR-V", "CR-V", "Passport", "Pilot", "Ridgeline", "Odyssey"],
  Hyundai: ["Elantra", "Sonata", "Venue", "Kona", "Tucson", "Santa Fe", "Palisade", "Santa Cruz", "Ioniq 5", "Ioniq 6"],
  Infiniti: ["Q50", "QX50", "QX55", "QX60", "QX80"],
  Jaguar: ["XE", "XF", "F-Pace", "E-Pace", "I-Pace"],
  Jeep: ["Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator", "Wagoneer"],
  Kia: ["Forte", "K4", "K5", "Soul", "Seltos", "Sportage", "Sorento", "Telluride", "Carnival", "EV6", "EV9"],
  "Land Rover": ["Discovery Sport", "Discovery", "Defender", "Range Rover Evoque", "Range Rover Velar", "Range Rover Sport", "Range Rover"],
  Lexus: ["IS", "ES", "LS", "UX", "NX", "RX", "GX", "LX", "RZ"],
  Lincoln: ["Corsair", "Nautilus", "Aviator", "Navigator"],
  Mazda: ["Mazda3", "CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "MX-5"],
  "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "S-Class", "CLA", "GLA", "GLB", "GLC", "GLE", "GLS", "EQS"],
  MINI: ["Cooper", "Countryman", "Clubman"],
  Mitsubishi: ["Mirage", "RVR", "Eclipse Cross", "Outlander", "Outlander PHEV"],
  Nissan: ["Sentra", "Altima", "Versa", "Kicks", "Qashqai", "Rogue", "Murano", "Pathfinder", "Armada", "Frontier", "Titan", "Leaf", "Ariya"],
  Porsche: ["718 Boxster", "718 Cayman", "911", "Panamera", "Macan", "Cayenne", "Taycan"],
  Ram: ["1500", "2500", "3500", "ProMaster"],
  Subaru: ["Impreza", "Legacy", "WRX", "Crosstrek", "Forester", "Outback", "Ascent", "BRZ", "Solterra"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  Toyota: ["Corolla", "Camry", "Prius", "Crown", "Corolla Cross", "RAV4", "Highlander", "Grand Highlander", "4Runner", "Sequoia", "Tacoma", "Tundra", "Sienna", "bZ4X"],
  Volkswagen: ["Jetta", "Golf", "Golf GTI", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport", "ID.4"],
  Volvo: ["S60", "S90", "V60", "XC40", "XC60", "XC90", "EX30", "EX90"],
} as const;

export type VehicleMake = keyof typeof vehicleMakesAndModels;
export const vehicleMakes = Object.keys(vehicleMakesAndModels) as VehicleMake[];

export const vehicleFeatures = [
  "Leather seats",
  "Heated seats",
  "Ventilated seats",
  "Heated steering wheel",
  "Remote start",
  "Navigation",
  "Apple CarPlay / Android Auto",
  "Backup camera",
  "360° camera",
  "Blind spot monitoring",
  "Adaptive cruise control",
  "Tow package",
  "Winter tires included",
  "CARFAX / CarProof available",
] as const;

export const MAX_ACTIVE_LISTINGS_PER_USER = 3;
export const DEALER_REPORT_THRESHOLD = 3;

export function parseOptionalInt(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

export const formatPriceCAD = (price: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);

export const formatMileageKm = (mileage: number) =>
  `${new Intl.NumberFormat("en-CA").format(mileage)} km`;
