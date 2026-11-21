import bcrypt from 'bcryptjs';
import { MAX_SECTORS, POSITIONS_PER_SECTOR } from '../shared/gameData';
import type { BuildingId, DefenseId, ResearchId, UnitId } from '../shared/types';
import { db } from './db';
import { emptyBuildings, emptyDefenses, emptyResearch, emptyUnits, recalculatePoints } from './engine';

interface AiTemplate {
  username: string;
  difficulty: 'Leicht' | 'Mittel' | 'Stark' | 'Festung';
  basePrefix: string;
  sector: number;
  position: number;
  steel: number;
  munition: number;
  fuel: number;
  buildings: Partial<Record<BuildingId, number>>;
  research: Partial<Record<ResearchId, number>>;
  units: Partial<Record<UnitId, number>>;
  defenses: Partial<Record<DefenseId, number>>;
}

const AI_BASES: AiTemplate[] = [
  // Sector 1: Beginner-friendly raid targets & mid-tier depots
  {
    username: 'Garnison Nord',
    difficulty: 'Leicht',
    basePrefix: 'Widerstandsnest Alpha',
    sector: 1,
    position: 3,
    steel: 4200,
    munition: 2600,
    fuel: 1200,
    buildings: { steel_mill: 4, munition_factory: 3, refinery: 2, power_plant: 4, hq: 2, tank_works: 1 },
    research: { weapons_tech: 0, armor_tech: 0, radio_intel: 0 },
    units: { infantry: 4, scout_car: 2 },
    defenses: { mg_nest: 2 },
  },
  {
    username: 'Nachschub-Kolonne',
    difficulty: 'Leicht',
    basePrefix: 'Felddepot Ost',
    sector: 1,
    position: 7,
    steel: 6800,
    munition: 4400,
    fuel: 2500,
    buildings: { steel_mill: 5, munition_factory: 4, refinery: 3, power_plant: 5, steel_storage: 1, hq: 2 },
    research: { weapons_tech: 1, armor_tech: 0, radio_intel: 1 },
    units: { infantry: 6, truck_convoy: 2 },
    defenses: { mg_nest: 4, pak_gun: 1 },
  },
  {
    username: 'Panzer-Aufklärer',
    difficulty: 'Mittel',
    basePrefix: 'Stellung Höhenkamm',
    sector: 1,
    position: 12,
    steel: 14500,
    munition: 9200,
    fuel: 4800,
    buildings: { steel_mill: 7, munition_factory: 6, refinery: 5, power_plant: 7, hq: 3, tank_works: 3, radar_station: 2 },
    research: { weapons_tech: 2, armor_tech: 2, radio_intel: 2 },
    units: { infantry: 12, light_tank: 5, scout_car: 4 },
    defenses: { mg_nest: 8, pak_gun: 3 },
  },

  // Sector 2: Medium & Heavy targets
  {
    username: 'Versorgungsstab II',
    difficulty: 'Leicht',
    basePrefix: 'Nachschublager Süd',
    sector: 2,
    position: 4,
    steel: 9500,
    munition: 6200,
    fuel: 3800,
    buildings: { steel_mill: 6, munition_factory: 5, refinery: 4, power_plant: 6, steel_storage: 2 },
    research: { weapons_tech: 1, armor_tech: 1, radio_intel: 1 },
    units: { infantry: 8, light_tank: 2 },
    defenses: { mg_nest: 5, pak_gun: 2 },
  },
  {
    username: 'Artillerie-Regiment 14',
    difficulty: 'Mittel',
    basePrefix: 'Batterie Waldrand',
    sector: 2,
    position: 9,
    steel: 22000,
    munition: 15500,
    fuel: 7200,
    buildings: { steel_mill: 8, munition_factory: 7, refinery: 6, power_plant: 8, hq: 4, tank_works: 4, radar_station: 3 },
    research: { weapons_tech: 3, armor_tech: 2, radio_intel: 2 },
    units: { infantry: 18, light_tank: 6, artillery: 3 },
    defenses: { mg_nest: 12, pak_gun: 5, flak_battery: 2 },
  },
  {
    username: 'Stahl-Brigade',
    difficulty: 'Stark',
    basePrefix: 'Panzer-Vorposten West',
    sector: 2,
    position: 14,
    steel: 42000,
    munition: 28000,
    fuel: 14000,
    buildings: { steel_mill: 10, munition_factory: 9, refinery: 8, power_plant: 10, hq: 5, tank_works: 5, airfield: 2 },
    research: { weapons_tech: 4, armor_tech: 4, radio_intel: 3 },
    units: { light_tank: 10, heavy_tank: 4, fighter: 3 },
    defenses: { mg_nest: 16, pak_gun: 8, flak_battery: 4, heavy_bunker: 2 },
  },

  // Sector 3: Industrial & Armored Front
  {
    username: 'Öl-Kommando III',
    difficulty: 'Mittel',
    basePrefix: 'Raffinerie-Knoten',
    sector: 3,
    position: 5,
    steel: 19000,
    munition: 14000,
    fuel: 18500,
    buildings: { steel_mill: 7, munition_factory: 7, refinery: 9, power_plant: 9, fuel_depot: 3 },
    research: { weapons_tech: 2, armor_tech: 3, radio_intel: 2 },
    units: { infantry: 14, light_tank: 6, truck_convoy: 4 },
    defenses: { mg_nest: 10, pak_gun: 5, flak_battery: 3 },
  },
  {
    username: 'Geschwader Falke',
    difficulty: 'Stark',
    basePrefix: 'Fliegerhorst Mitte',
    sector: 3,
    position: 11,
    steel: 48000,
    munition: 36000,
    fuel: 22000,
    buildings: { steel_mill: 10, munition_factory: 10, refinery: 9, power_plant: 11, airfield: 5, radar_station: 4 },
    research: { weapons_tech: 5, armor_tech: 4, engine_tech: 5, radio_intel: 4 },
    units: { fighter: 10, bomber: 4, light_tank: 8 },
    defenses: { mg_nest: 14, pak_gun: 6, flak_battery: 10, heavy_bunker: 2 },
  },

  // Sector 4 & 5: Endgame Fortresses
  {
    username: 'Festungskommando IV',
    difficulty: 'Stark',
    basePrefix: 'Sperrwerk Eisenwall',
    sector: 4,
    position: 6,
    steel: 75000,
    munition: 52000,
    fuel: 28000,
    buildings: { steel_mill: 12, munition_factory: 11, refinery: 10, power_plant: 12, hq: 6, tank_works: 6, radar_station: 5 },
    research: { weapons_tech: 6, armor_tech: 6, radio_intel: 5 },
    units: { heavy_tank: 8, artillery: 6, fighter: 6 },
    defenses: { mg_nest: 24, pak_gun: 12, flak_battery: 8, heavy_bunker: 5 },
  },
  {
    username: 'Zitadelle 1942',
    difficulty: 'Festung',
    basePrefix: 'Hauptfestung Adlerhorst',
    sector: 5,
    position: 8,
    steel: 140000,
    munition: 95000,
    fuel: 55000,
    buildings: { steel_mill: 14, munition_factory: 13, refinery: 12, power_plant: 14, hq: 8, tank_works: 8, airfield: 6, radar_station: 6 },
    research: { weapons_tech: 8, armor_tech: 8, engine_tech: 6, radio_intel: 6 },
    units: { heavy_tank: 16, artillery: 10, fighter: 12, bomber: 6 },
    defenses: { mg_nest: 40, pak_gun: 20, flak_battery: 16, heavy_bunker: 10 },
  },
];

export function seedAiSectors(): void {
  const existingAi = (
    db.prepare('SELECT COUNT(*) as c FROM users WHERE is_ai = 1').get() as { c: number }
  ).c;
  if (existingAi > 0) return;

  const now = Date.now();
  const aiPasswordHash = bcrypt.hashSync('ai-locked-account-1942', 4);

  for (const tpl of AI_BASES) {
    const res = db
      .prepare(
        `INSERT INTO users (username, password_hash, commander_title, is_ai, ai_difficulty, created_at)
         VALUES (?, ?, 'KI-Kommando', 1, ?, ?)`
      )
      .run(tpl.username, aiPasswordHash, tpl.difficulty, now);
    const userId = Number(res.lastInsertRowid);

    const research = { ...emptyResearch(), ...tpl.research };
    db.prepare('INSERT INTO user_research (user_id, levels_json) VALUES (?, ?)').run(
      userId,
      JSON.stringify(research)
    );

    const buildings = { ...emptyBuildings(), ...tpl.buildings };
    const units = { ...emptyUnits(), ...tpl.units };
    const defenses = { ...emptyDefenses(), ...tpl.defenses };

    db.prepare(
      `INSERT INTO bases (user_id, name, sector, position, is_home, steel, munition, fuel, buildings_json, units_json, defenses_json, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      tpl.basePrefix,
      tpl.sector,
      tpl.position,
      tpl.steel,
      tpl.munition,
      tpl.fuel,
      JSON.stringify(buildings),
      JSON.stringify(units),
      JSON.stringify(defenses),
      now
    );

    recalculatePoints(userId);
  }
}

export function findFreeHomeSlot(): { sector: number; position: number } {
  // Prefer Sector 1 first so new players start near beginner AI bases
  for (let s = 1; s <= MAX_SECTORS; s++) {
    const occupied = new Set(
      (
        db.prepare('SELECT position FROM bases WHERE sector = ?').all(s) as Array<{
          position: number;
        }>
      ).map((r) => r.position)
    );
    const candidates: number[] = [];
    for (let p = 1; p <= POSITIONS_PER_SECTOR; p++) {
      if (!occupied.has(p)) candidates.push(p);
    }
    if (candidates.length > 0) {
      const pos = candidates[Math.floor(Math.random() * candidates.length)];
      return { sector: s, position: pos };
    }
  }
  throw new Error('Alle Sektorpositionen sind derzeit belegt.');
}
