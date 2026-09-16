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
  "Sedan","SUV","Pickup","Hatchback","Coupe","Wagon","Van/Minivan","Convertible"
] as const;

export const transmissions = ["Automatic", "Manual"] as const;
export const fuelTypes = ["Gasoline", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric"] as const;
export const drivetrains = ["FWD", "RWD", "AWD", "4WD"] as const;

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

export const vehicleFeatures = [
  "Leather seats","Heated seats","Ventilated seats","Heated steering wheel","Remote start",
  "Navigation","Apple CarPlay / Android Auto","Backup camera","360° camera","Blind spot monitoring",
  "Adaptive cruise control","Tow package","Winter tires included","CARFAX / CarProof available"
] as const;

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
