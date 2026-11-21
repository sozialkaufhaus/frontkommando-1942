import type {
  BuildingDef,
  BuildingId,
  CombatEntityId,
  DefenseDef,
  DefenseId,
  Prerequisite,
  ResearchDef,
  ResearchId,
  Resources,
  UnitDef,
  UnitId,
} from './types';

// Game speed multiplier for crisp, responsive real-time gameplay
export const GAME_SPEED = 12; // 12x classic OGame pace so builds/production feel brisk & engaging
export const FLEET_SPEED = 4;
export const MAX_SECTORS = 5;
export const POSITIONS_PER_SECTOR = 15;

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  steel_mill: {
    id: 'steel_mill',
    name: 'Stahlwerk',
    category: 'resources',
    description: 'Schmilzt Eisenerz zu hochwertigem Panzerstahl für Stützpunkte, Geschütze und Fahrzeuge.',
    baseCost: { steel: 60, munition: 15, fuel: 0 },
    costFactor: 1.5,
    baseEnergyUse: 10,
    image: '/assets/bld-steel.svg',
  },
  munition_factory: {
    id: 'munition_factory',
    name: 'Rüstungsfabrik',
    category: 'resources',
    description: 'Fertigt Munition, Aluminium-Legierungen und Präzisionsbauteile für Heer und Luftwaffe.',
    baseCost: { steel: 48, munition: 24, fuel: 0 },
    costFactor: 1.6,
    baseEnergyUse: 12,
    image: '/assets/bld-factory.jpg',
  },
  refinery: {
    id: 'refinery',
    name: 'Raffinerie',
    category: 'resources',
    description: 'Destilliert Rohöl zu Diesel und Flugbenzin für Verbände, Panzer und Missionen.',
    baseCost: { steel: 225, munition: 75, fuel: 0 },
    costFactor: 1.5,
    baseEnergyUse: 20,
    image: '/assets/bld-refinery.jpg',
  },
  power_plant: {
    id: 'power_plant',
    name: 'Kraftwerk',
    category: 'resources',
    description: 'Versorgt den gesamten Stützpunkt mit Strom. Bei Strommangel sinkt die Rohstoffproduktion.',
    baseCost: { steel: 75, munition: 30, fuel: 0 },
    costFactor: 1.5,
    image: '/assets/bld-power.jpg',
  },
  steel_storage: {
    id: 'steel_storage',
    name: 'Stahllager',
    category: 'resources',
    description: 'Erhöht die Lagerkapazität für Stahl und Munition gegen Produktionsstopps.',
    baseCost: { steel: 1000, munition: 200, fuel: 0 },
    costFactor: 2.0,
    image: '/assets/bld-storage.jpg',
  },
  fuel_depot: {
    id: 'fuel_depot',
    name: 'Treibstoffdepot',
    category: 'resources',
    description: 'Gepanzerte Großtanks zur Erweiterung der Treibstoff- und Munitionskapazität.',
    baseCost: { steel: 1000, munition: 500, fuel: 0 },
    costFactor: 2.0,
    image: '/assets/bld-refinery.jpg',
  },
  hq: {
    id: 'hq',
    name: 'Kommandozentrale',
    category: 'facility',
    description: 'Koordiniert den Ausbau des Stützpunkts und verkürzt alle Gebäudebauzeiten drastisch.',
    baseCost: { steel: 400, munition: 120, fuel: 200 },
    costFactor: 2.0,
    image: '/assets/bld-hq.jpg',
  },
  tank_works: {
    id: 'tank_works',
    name: 'Panzerwerk',
    category: 'facility',
    description: 'Schwere Montagehalle für Infanterie-Ausrüstung, Panzer, Artillerie und Verteidigungsanlagen.',
    baseCost: { steel: 400, munition: 200, fuel: 100 },
    costFactor: 2.0,
    image: '/assets/bld-tankworks.svg',
    prereq: { building: { hq: 2 } },
  },
  airfield: {
    id: 'airfield',
    name: 'Flugplatz',
    category: 'facility',
    description: 'Start- und Landebahnen samt Hangars zum Bau und Einsatz von Jagdflugzeugen und Bombern.',
    baseCost: { steel: 600, munition: 400, fuel: 300 },
    costFactor: 2.0,
    image: '/assets/bld-airfield.svg',
    prereq: { building: { hq: 3, tank_works: 2 } },
  },
  research_lab: {
    id: 'research_lab',
    name: 'Forschungszentrum',
    category: 'facility',
    description: 'Entwickelt neue Panzerungen, Geschütze, Motoren und Funktechnik. Jede Stufe beschleunigt Forschung.',
    baseCost: { steel: 200, munition: 400, fuel: 200 },
    costFactor: 2.0,
    image: '/assets/bld-research.jpg',
  },
  radar_station: {
    id: 'radar_station',
    name: 'Radarstation',
    category: 'facility',
    description: 'Frühwarnsystem zur Abwehr feindlicher Aufklärung und Verbesserung eigener Sektor-Scans.',
    baseCost: { steel: 300, munition: 350, fuel: 150 },
    costFactor: 1.8,
    image: '/assets/bld-radar.jpg',
    prereq: { building: { research_lab: 1 } },
  },
};

export const BUILDING_ORDER: BuildingId[] = [
  'steel_mill',
  'munition_factory',
  'refinery',
  'power_plant',
  'steel_storage',
  'fuel_depot',
  'hq',
  'tank_works',
  'airfield',
  'research_lab',
  'radar_station',
];

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  armor_tech: {
    id: 'armor_tech',
    name: 'Panzerungstechnik',
    description: 'Verbesserte Stahllegierungen und abgeschrägte Panzerplatten erhöhen die Standfestigkeit aller Einheiten.',
    effectText: '+10% Panzerung & Struktur pro Stufe',
    baseCost: { steel: 1000, munition: 200, fuel: 0 },
    costFactor: 2.0,
    image: '/assets/bld-tankworks.svg',
    prereq: { building: { research_lab: 1 } },
  },
  weapons_tech: {
    id: 'weapons_tech',
    name: 'Waffentechnik',
    description: 'Höhere Mündungsgeschwindigkeiten und panzerbrechende Geschosse steigern die Feuerkraft.',
    effectText: '+10% Angriffskraft pro Stufe',
    baseCost: { steel: 800, munition: 400, fuel: 0 },
    costFactor: 2.0,
    image: '/assets/unit-artillery.svg',
    prereq: { building: { research_lab: 2 } },
  },
  engine_tech: {
    id: 'engine_tech',
    name: 'Motorentechnik',
    description: 'Leistungsstärkere Diesel- und Flugmotoren verkürzen die Marsch- und Flugzeiten aller Verbände.',
    effectText: '+10% Verbandsgeschwindigkeit pro Stufe',
    baseCost: { steel: 400, munition: 200, fuel: 600 },
    costFactor: 2.0,
    image: '/assets/unit-light-tank.jpg',
    prereq: { building: { research_lab: 1 } },
  },
  radio_intel: {
    id: 'radio_intel',
    name: 'Funkaufklärung',
    description: 'Entschlüsselung feindlicher Funksprüche liefert tiefere Spionageberichte und erschwert gegnerische Aufklärung.',
    effectText: 'Detailliertere Spionageberichte & Aufklärungsschutz',
    baseCost: { steel: 200, munition: 1000, fuel: 200 },
    costFactor: 2.0,
    image: '/assets/bld-radar.jpg',
    prereq: { building: { research_lab: 2 } },
  },
  logistics: {
    id: 'logistics',
    name: 'Logistik',
    description: 'Effizientere Stabs- und Nachschubkoordination erlaubt mehr gleichzeitige Einsatzverbände.',
    effectText: '+1 gleichzeitiger Marschverband pro Stufe',
    baseCost: { steel: 400, munition: 600, fuel: 400 },
    costFactor: 2.0,
    image: '/assets/unit-convoy.jpg',
    prereq: { building: { research_lab: 1 } },
  },
  colonization: {
    id: 'colonization',
    name: 'Logistik-Kolonisierung',
    description: 'Ermöglicht die Einnahme und Versorgung zusätzlicher Front-Stützpunkte in freien Sektorpositionen.',
    effectText: '+1 maximaler Stützpunkt pro Stufe',
    baseCost: { steel: 2500, munition: 2000, fuel: 1500 },
    costFactor: 1.9,
    image: '/assets/bld-hq.jpg',
    prereq: { building: { research_lab: 3 }, research: { logistics: 2, engine_tech: 2 } },
  },
};

export const RESEARCH_ORDER: ResearchId[] = [
  'armor_tech',
  'weapons_tech',
  'engine_tech',
  'radio_intel',
  'logistics',
  'colonization',
];

export const UNITS: Record<UnitId, UnitDef> = {
  scout_car: {
    id: 'scout_car',
    name: 'Spähwagen',
    category: 'ground',
    description: 'Leicht gepanzertes Aufklärungsfahrzeug. Extrem schnell, ideal für Spionagemissionen.',
    cost: { steel: 400, munition: 600, fuel: 100 },
    structure: 1000,
    shield: 10,
    attack: 20,
    speed: 24000,
    cargo: 200,
    fuelConsumption: 5,
    image: '/assets/unit-scout.jpg',
    prereq: { building: { tank_works: 1 } },
  },
  truck_convoy: {
    id: 'truck_convoy',
    name: 'LKW-Konvoi',
    category: 'ground',
    description: 'Unbewaffneter Nachschubkonvoi mit enormer Ladekapazität für Beute und Rohstofftransporte.',
    cost: { steel: 2000, munition: 2000, fuel: 0 },
    structure: 4000,
    shield: 20,
    attack: 10,
    speed: 8500,
    cargo: 15000,
    fuelConsumption: 20,
    image: '/assets/unit-convoy.jpg',
    prereq: { building: { tank_works: 1 }, research: { engine_tech: 1 } },
  },
  infantry: {
    id: 'infantry',
    name: 'Infanterie-Trupp',
    category: 'ground',
    description: 'Vielseitige Fronttruppe. Kostengünstig in Masse und wirksam gegen ungeschützte Geschütze.',
    cost: { steel: 600, munition: 400, fuel: 50 },
    structure: 1200,
    shield: 15,
    attack: 55,
    speed: 6500,
    cargo: 400,
    fuelConsumption: 8,
    rapidfire: { pak_gun: 2, artillery: 2 },
    image: '/assets/unit-infantry.svg',
    prereq: { building: { tank_works: 1 } },
  },
  light_tank: {
    id: 'light_tank',
    name: 'Leichter Panzer',
    category: 'ground',
    description: 'Schneller Durchbruchspanzer für Flankenstöße und schnelle Überfälle.',
    cost: { steel: 3000, munition: 1000, fuel: 250 },
    structure: 4000,
    shield: 40,
    attack: 160,
    speed: 12500,
    cargo: 1200,
    fuelConsumption: 30,
    rapidfire: { scout_car: 4, infantry: 3 },
    image: '/assets/unit-light-tank.jpg',
    prereq: { building: { tank_works: 2 }, research: { engine_tech: 2 } },
  },
  heavy_tank: {
    id: 'heavy_tank',
    name: 'Schwerer Panzer',
    category: 'ground',
    description: 'Das Rückgrat der Panzerwaffe. Enorme Panzerung und durchschlagskräftige Hauptkanone.',
    cost: { steel: 10000, munition: 4500, fuel: 1500 },
    structure: 16000,
    shield: 180,
    attack: 620,
    speed: 7500,
    cargo: 2500,
    fuelConsumption: 90,
    rapidfire: { light_tank: 3, mg_nest: 4, scout_car: 5 },
    image: '/assets/unit-heavy-tank.svg',
    prereq: { building: { tank_works: 4 }, research: { armor_tech: 3, weapons_tech: 2 } },
  },
  artillery: {
    id: 'artillery',
    name: 'Feldartillerie',
    category: 'ground',
    description: 'Schwere Haubitzenbatterie mit verheerender Wirkung gegen feindliche Stellungen und Bunker.',
    cost: { steel: 7500, munition: 5500, fuel: 1000 },
    structure: 9500,
    shield: 60,
    attack: 880,
    speed: 5500,
    cargo: 800,
    fuelConsumption: 75,
    rapidfire: { mg_nest: 6, pak_gun: 4, heavy_bunker: 3 },
    image: '/assets/unit-artillery.svg',
    prereq: { building: { tank_works: 3 }, research: { weapons_tech: 3 } },
  },
  fighter: {
    id: 'fighter',
    name: 'Jagdflugzeug',
    category: 'air',
    description: 'Hochgeschwindigkeits-Abfangjäger zur Sicherung der Lufthoheit gegen feindliche Bomber.',
    cost: { steel: 4500, munition: 3500, fuel: 1200 },
    structure: 6500,
    shield: 75,
    attack: 340,
    speed: 28000,
    cargo: 300,
    fuelConsumption: 60,
    rapidfire: { bomber: 4, scout_car: 4, truck_convoy: 3 },
    image: '/assets/unit-fighter.svg',
    prereq: { building: { airfield: 1 }, research: { engine_tech: 3 } },
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    category: 'air',
    description: 'Taktischer Zweimotor-Bomber für vernichtende Luftschläge gegen Panzer und Befestigungen.',
    cost: { steel: 14000, munition: 9000, fuel: 4000 },
    structure: 22000,
    shield: 220,
    attack: 1250,
    speed: 18000,
    cargo: 4000,
    fuelConsumption: 160,
    rapidfire: { mg_nest: 8, pak_gun: 6, heavy_bunker: 4, heavy_tank: 2 },
    image: '/assets/unit-bomber.svg',
    prereq: { building: { airfield: 3 }, research: { engine_tech: 4, weapons_tech: 4 } },
  },
};

export const UNIT_ORDER: UnitId[] = [
  'scout_car',
  'truck_convoy',
  'infantry',
  'light_tank',
  'heavy_tank',
  'artillery',
  'fighter',
  'bomber',
];

export const DEFENSES: Record<DefenseId, DefenseDef> = {
  mg_nest: {
    id: 'mg_nest',
    name: 'MG-Nest',
    description: 'Befestigte Maschinengewehr-Stellung. Günstige Basisverteidigung, tödlich gegen Infanterie.',
    cost: { steel: 1500, munition: 500, fuel: 0 },
    structure: 2000,
    shield: 25,
    attack: 95,
    rapidfire: { infantry: 4, scout_car: 3 },
    image: '/assets/def-mg.svg',
    prereq: { building: { tank_works: 1 } },
  },
  pak_gun: {
    id: 'pak_gun',
    name: 'Pak-Geschütz',
    description: 'Panzerabwehrkanone mit hoher Durchschlagskraft gegen gepanzerte Angreifer.',
    cost: { steel: 4000, munition: 2000, fuel: 0 },
    structure: 6000,
    shield: 80,
    attack: 320,
    rapidfire: { light_tank: 3, truck_convoy: 4 },
    image: '/assets/def-pak.svg',
    prereq: { building: { tank_works: 2 }, research: { weapons_tech: 1 } },
  },
  flak_battery: {
    id: 'flak_battery',
    name: 'Flak-Batterie',
    description: 'Schwere Flugabwehrstellung zum wirksamen Schutz gegen Jagdflugzeuge und Bomber.',
    cost: { steel: 5500, munition: 4000, fuel: 500 },
    structure: 8500,
    shield: 110,
    attack: 420,
    rapidfire: { fighter: 4, bomber: 3 },
    image: '/assets/def-flak.svg',
    prereq: { building: { tank_works: 3 }, research: { weapons_tech: 2, radio_intel: 1 } },
  },
  heavy_bunker: {
    id: 'heavy_bunker',
    name: 'Schwerer Bunker',
    description: 'Massiver Stahlbeton-Gefechtsbunker mit schwerer Festungsartillerie und enormer Standfestigkeit.',
    cost: { steel: 16000, munition: 8000, fuel: 2000 },
    structure: 28000,
    shield: 420,
    attack: 980,
    rapidfire: { light_tank: 4, infantry: 6 },
    image: '/assets/def-bunker.svg',
    prereq: { building: { tank_works: 4 }, research: { armor_tech: 3, weapons_tech: 3 } },
  },
};

export const DEFENSE_ORDER: DefenseId[] = [
  'mg_nest',
  'pak_gun',
  'flak_battery',
  'heavy_bunker',
];

// ================= FORMULAS (Classic OGame Logic) =================

export function getBuildingCost(id: BuildingId, targetLevel: number): Resources {
  const def = BUILDINGS[id];
  const mult = Math.pow(def.costFactor, targetLevel - 1);
  return {
    steel: Math.floor(def.baseCost.steel * mult),
    munition: Math.floor(def.baseCost.munition * mult),
    fuel: Math.floor(def.baseCost.fuel * mult),
  };
}

export function getBuildingDurationSec(id: BuildingId, targetLevel: number, hqLevel: number): number {
  const cost = getBuildingCost(id, targetLevel);
  const rawHours = (cost.steel + cost.munition) / (2500 * (1 + hqLevel) * GAME_SPEED);
  return Math.max(4, Math.floor(rawHours * 3600));
}

export function getResearchCost(id: ResearchId, targetLevel: number): Resources {
  const def = RESEARCH[id];
  const mult = Math.pow(def.costFactor, targetLevel - 1);
  return {
    steel: Math.floor(def.baseCost.steel * mult),
    munition: Math.floor(def.baseCost.munition * mult),
    fuel: Math.floor(def.baseCost.fuel * mult),
  };
}

export function getResearchDurationSec(id: ResearchId, targetLevel: number, labLevel: number): number {
  const cost = getResearchCost(id, targetLevel);
  const rawHours = (cost.steel + cost.munition + cost.fuel) / (1200 * (1 + labLevel) * GAME_SPEED);
  return Math.max(6, Math.floor(rawHours * 3600));
}

export function getUnitDurationSec(entityId: CombatEntityId, tankWorksLevel: number, airfieldLevel: number): number {
  const isUnit = entityId in UNITS;
  const def = isUnit ? UNITS[entityId as UnitId] : DEFENSES[entityId as DefenseId];
  const isAir = isUnit && UNITS[entityId as UnitId].category === 'air';
  const facilityLevel = isAir ? airfieldLevel : tankWorksLevel;
  const rawHours = (def.cost.steel + def.cost.munition) / (2500 * (1 + facilityLevel) * GAME_SPEED);
  return Math.max(2, Math.floor(rawHours * 3600));
}

export function getEnergyProduced(powerPlantLevel: number): number {
  if (powerPlantLevel <= 0) return 20; // Base generator
  return 20 + Math.floor(24 * powerPlantLevel * Math.pow(1.1, powerPlantLevel));
}

export function getBuildingEnergyUse(id: BuildingId, level: number): number {
  const def = BUILDINGS[id];
  if (!def.baseEnergyUse || level <= 0) return 0;
  return Math.ceil(def.baseEnergyUse * level * Math.pow(1.1, level));
}

export function getTotalEnergyConsumed(buildings: Record<BuildingId, number>): number {
  return (
    getBuildingEnergyUse('steel_mill', buildings.steel_mill) +
    getBuildingEnergyUse('munition_factory', buildings.munition_factory) +
    getBuildingEnergyUse('refinery', buildings.refinery)
  );
}

export function getStorageCapacity(storageLevel: number): number {
  // Classic OGame exponential storage curve
  return Math.floor(5000 * (2.5 * Math.exp((20 * storageLevel) / 33)));
}

export function getBaseStorage(buildings: Record<BuildingId, number>): Resources {
  const steelCap = getStorageCapacity(buildings.steel_storage);
  const fuelCap = getStorageCapacity(buildings.fuel_depot);
  const munitionCap = Math.floor((steelCap + fuelCap) * 0.65);
  return {
    steel: steelCap,
    munition: munitionCap,
    fuel: fuelCap,
  };
}

export function getBaseProductionPerHour(buildings: Record<BuildingId, number>): {
  production: Resources;
  energyProduced: number;
  energyConsumed: number;
  energyEfficiency: number;
} {
  const energyProduced = getEnergyProduced(buildings.power_plant);
  const energyConsumed = getTotalEnergyConsumed(buildings);
  const energyEfficiency =
    energyConsumed <= 0 ? 1 : Math.min(1, energyProduced / energyConsumed);

  const baseSteel = 30 * GAME_SPEED;
  const baseMunition = 18 * GAME_SPEED;
  const baseFuel = 8 * GAME_SPEED;

  const millSteel =
    buildings.steel_mill > 0
      ? 35 * buildings.steel_mill * Math.pow(1.1, buildings.steel_mill) * GAME_SPEED * energyEfficiency
      : 0;
  const factoryMunition =
    buildings.munition_factory > 0
      ? 24 * buildings.munition_factory * Math.pow(1.1, buildings.munition_factory) * GAME_SPEED * energyEfficiency
      : 0;
  const refineryFuel =
    buildings.refinery > 0
      ? 14 * buildings.refinery * Math.pow(1.1, buildings.refinery) * GAME_SPEED * energyEfficiency
      : 0;

  return {
    production: {
      steel: Math.floor(baseSteel + millSteel),
      munition: Math.floor(baseMunition + factoryMunition),
      fuel: Math.floor(baseFuel + refineryFuel),
    },
    energyProduced,
    energyConsumed,
    energyEfficiency,
  };
}

export function checkPrerequisites(
  prereq: Prerequisite | undefined,
  buildings: Record<BuildingId, number>,
  research: Record<ResearchId, number>
): { met: boolean; missing: string[] } {
  if (!prereq) return { met: true, missing: [] };
  const missing: string[] = [];
  if (prereq.building) {
    for (const [bId, reqLvl] of Object.entries(prereq.building) as [BuildingId, number][]) {
      if ((buildings[bId] ?? 0) < reqLvl) {
        missing.push(`${BUILDINGS[bId].name} St. ${reqLvl}`);
      }
    }
  }
  if (prereq.research) {
    for (const [rId, reqLvl] of Object.entries(prereq.research) as [ResearchId, number][]) {
      if ((research[rId] ?? 0) < reqLvl) {
        missing.push(`${RESEARCH[rId].name} St. ${reqLvl}`);
      }
    }
  }
  return { met: missing.length === 0, missing };
}

export function getMissionDistance(
  s1: number,
  p1: number,
  s2: number,
  p2: number
): number {
  if (s1 !== s2) {
    return Math.abs(s1 - s2) * 3200 + Math.abs(p1 - p2) * 80;
  }
  if (p1 !== p2) {
    return 1000 + Math.abs(p1 - p2) * 140;
  }
  return 500;
}

export function getFleetTravelStats(
  units: Partial<Record<UnitId, number>>,
  s1: number,
  p1: number,
  s2: number,
  p2: number,
  engineTechLevel: number
): { durationSec: number; fuelCost: number; cargoCapacity: number; slowestSpeed: number } {
  let slowestSpeed = Infinity;
  let cargoCapacity = 0;
  let totalFuelBase = 0;

  for (const [uId, count] of Object.entries(units) as [UnitId, number][]) {
    if (!count || count <= 0) continue;
    const def = UNITS[uId];
    const effectiveSpeed = def.speed * (1 + engineTechLevel * 0.1);
    if (effectiveSpeed < slowestSpeed) slowestSpeed = effectiveSpeed;
    cargoCapacity += def.cargo * count;
    totalFuelBase += def.fuelConsumption * count;
  }

  if (!Number.isFinite(slowestSpeed)) {
    return { durationSec: 0, fuelCost: 0, cargoCapacity: 0, slowestSpeed: 0 };
  }

  const dist = getMissionDistance(s1, p1, s2, p2);
  const durationSec = Math.max(
    8,
    Math.round((12 + (12000 * Math.sqrt((dist * 10) / slowestSpeed)) / 40) / FLEET_SPEED)
  );
  const fuelCost = Math.max(1, Math.ceil((totalFuelBase * dist) / 2800));
  return { durationSec, fuelCost, cargoCapacity, slowestSpeed: Math.round(slowestSpeed) };
}

export function getMaxSimultaneousMissions(logisticsLevel: number): number {
  return 1 + logisticsLevel;
}

export function getMaxBases(colonizationLevel: number): number {
  return 1 + colonizationLevel;
}

export function getCombatEntityStats(id: CombatEntityId) {
  if (id in UNITS) {
    const u = UNITS[id as UnitId];
    return {
      name: u.name,
      structure: u.structure,
      shield: u.shield,
      attack: u.attack,
      cost: u.cost,
      rapidfire: u.rapidfire,
      isDefense: false,
    };
  }
  const d = DEFENSES[id as DefenseId];
  return {
    name: d.name,
    structure: d.structure,
    shield: d.shield,
    attack: d.attack,
    cost: d.cost,
    rapidfire: d.rapidfire,
    isDefense: true,
  };
}
