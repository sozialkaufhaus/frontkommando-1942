import {
  BUILDINGS,
  BUILDING_ORDER,
  DEFENSES,
  DEFENSE_ORDER,
  RESEARCH,
  RESEARCH_ORDER,
  UNITS,
  UNIT_ORDER,
  getBaseProductionPerHour,
  getBaseStorage,
  getBuildingCost,
  getMaxBases,
  getResearchCost,
} from '../shared/gameData';
import type {
  BaseState,
  BuildingId,
  CombatEntityId,
  DefenseId,
  FleetMission,
  MissionType,
  ResearchId,
  Resources,
  SpyReportData,
  UnitId,
  UnitQueueItem,
} from '../shared/types';
import { FACTIONS, getProvinceByCoords, type FactionId } from '../shared/worldMap';
import { simulateCombat } from './combat';
import { db } from './db';
import { notifyUser } from './realtime';

export function emptyBuildings(): Record<BuildingId, number> {
  return {
    steel_mill: 1,
    munition_factory: 1,
    refinery: 0,
    power_plant: 2,
    steel_storage: 0,
    fuel_depot: 0,
    hq: 1,
    tank_works: 0,
    airfield: 0,
    shipyard: 0,
    research_lab: 0,
    radar_station: 0,
  };
}

export function emptyResearch(): Record<ResearchId, number> {
  return {
    armor_tech: 0,
    weapons_tech: 0,
    engine_tech: 0,
    radio_intel: 0,
    logistics: 0,
    colonization: 0,
  };
}

export function emptyUnits(): Record<UnitId, number> {
  const out = {} as Record<UnitId, number>;
  for (const id of UNIT_ORDER) {
    out[id] = 0;
  }
  return out;
}

export function emptyDefenses(): Record<DefenseId, number> {
  return {
    mg_nest: 0,
    pak_gun: 0,
    flak_battery: 0,
    heavy_bunker: 0,
  };
}

export function parseBuildings(json: string): Record<BuildingId, number> {
  return { ...emptyBuildings(), ...JSON.parse(json) };
}

export function parseResearch(json: string): Record<ResearchId, number> {
  return { ...emptyResearch(), ...JSON.parse(json) };
}

export function parseUnits(json: string): Record<UnitId, number> {
  return { ...emptyUnits(), ...JSON.parse(json) };
}

export function parseDefenses(json: string): Record<DefenseId, number> {
  return { ...emptyDefenses(), ...JSON.parse(json) };
}

export function getUserResearch(userId: number): Record<ResearchId, number> {
  const row = db
    .prepare('SELECT levels_json FROM user_research WHERE user_id = ?')
    .get(userId) as { levels_json: string } | undefined;
  if (!row) {
    const init = emptyResearch();
    db.prepare('INSERT OR IGNORE INTO user_research (user_id, levels_json) VALUES (?, ?)').run(
      userId,
      JSON.stringify(init)
    );
    return init;
  }
  return parseResearch(row.levels_json);
}

export function sendMessage(
  userId: number,
  type: 'combat' | 'spy' | 'transport' | 'system' | 'diplomacy',
  title: string,
  body: string,
  data: unknown = null,
  createdAt: number = Date.now()
): void {
  db.prepare(
    'INSERT INTO messages (user_id, type, title, body, data_json, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(userId, type, title, body, data ? JSON.stringify(data) : null, createdAt);
  notifyUser(userId, 'message', { type, title });
}

interface BaseRow {
  id: number;
  user_id: number;
  name: string;
  sector: number;
  position: number;
  is_home: number;
  steel: number;
  munition: number;
  fuel: number;
  buildings_json: string;
  units_json: string;
  defenses_json: string;
  updated_at: number;
}

export function syncBase(baseId: number, now: number = Date.now()): BaseState | null {
  const row = db.prepare('SELECT * FROM bases WHERE id = ?').get(baseId) as BaseRow | undefined;
  if (!row) return null;

  const buildings = parseBuildings(row.buildings_json);
  const units = parseUnits(row.units_json);
  const defenses = parseDefenses(row.defenses_json);

  let steel = row.steel;
  let munition = row.munition;
  let fuel = row.fuel;
  let lastUpdated = row.updated_at;
  let dirty = false;
  let pointsChanged = false;

  // 1. Check if building queue completed before `now`
  const bq = db.prepare('SELECT * FROM build_queue WHERE base_id = ?').get(baseId) as
    | {
        id: number;
        base_id: number;
        building_id: BuildingId;
        target_level: number;
        started_at: number;
        ends_at: number;
      }
    | undefined;

  const ownerRow = db
    .prepare('SELECT faction FROM users WHERE id = ?')
    .get(row.user_id) as { faction: FactionId } | undefined;
  const factionDef = FACTIONS[ownerRow?.faction || 'mitteleuropa'] || FACTIONS.mitteleuropa;
  const prov = getProvinceByCoords(row.sector, row.position);

  const getEffectiveProduction = (bld: Record<BuildingId, number>) => {
    const base = getBaseProductionPerHour(bld);
    const steelMult =
      1 + factionDef.bonuses.steelProd + (prov?.bonus.type === 'steel' ? prov.bonus.percent / 100 : 0);
    const munMult =
      1 + factionDef.bonuses.munitionProd + (prov?.bonus.type === 'munition' ? prov.bonus.percent / 100 : 0);
    const fuelMult =
      1 + factionDef.bonuses.fuelProd + (prov?.bonus.type === 'fuel' ? prov.bonus.percent / 100 : 0);
    return {
      ...base,
      production: {
        steel: Math.floor(base.production.steel * steelMult),
        munition: Math.floor(base.production.munition * munMult),
        fuel: Math.floor(base.production.fuel * fuelMult),
      },
    };
  };

  const addResourcesUntil = (untilMs: number) => {
    const dtSec = Math.max(0, (untilMs - lastUpdated) / 1000);
    if (dtSec <= 0) return;
    const storage = getBaseStorage(buildings);
    const { production } = getEffectiveProduction(buildings);

    if (steel < storage.steel) {
      steel = Math.min(storage.steel, steel + (production.steel / 3600) * dtSec);
    }
    if (munition < storage.munition) {
      munition = Math.min(storage.munition, munition + (production.munition / 3600) * dtSec);
    }
    if (fuel < storage.fuel) {
      fuel = Math.min(storage.fuel, fuel + (production.fuel / 3600) * dtSec);
    }
    lastUpdated = untilMs;
    dirty = true;
  };

  if (bq && bq.ends_at <= now) {
    // Tick resources at old production rate up to completion
    addResourcesUntil(bq.ends_at);
    buildings[bq.building_id] = bq.target_level;
    db.prepare('DELETE FROM build_queue WHERE id = ?').run(bq.id);
    dirty = true;
    pointsChanged = true;
  }

  // Tick remaining resources up to `now`
  addResourcesUntil(now);

  // 2. Process unit/defense production queue sequentially
  const uqRows = db
    .prepare('SELECT * FROM unit_queue WHERE base_id = ? ORDER BY id ASC')
    .all(baseId) as Array<{
    id: number;
    base_id: number;
    entity_type: 'unit' | 'defense';
    entity_id: CombatEntityId;
    count: number;
    unit_duration_sec: number;
    started_at: number;
    next_ends_at: number;
  }>;

  let carryOverTime: number | null = null;

  for (const item of uqRows) {
    let nextEnds = item.next_ends_at;
    let remaining = item.count;

    if (carryOverTime !== null && item.started_at > carryOverTime) {
      // Shift queued item start if previous finished earlier
      nextEnds = carryOverTime + item.unit_duration_sec * 1000;
    }

    let produced = 0;
    while (remaining > 0 && nextEnds <= now) {
      produced++;
      remaining--;
      carryOverTime = nextEnds;
      nextEnds += item.unit_duration_sec * 1000;
    }

    if (produced > 0) {
      if (item.entity_type === 'unit') {
        units[item.entity_id as UnitId] = (units[item.entity_id as UnitId] || 0) + produced;
      } else {
        defenses[item.entity_id as DefenseId] =
          (defenses[item.entity_id as DefenseId] || 0) + produced;
      }
      dirty = true;
      pointsChanged = true;

      if (remaining <= 0) {
        db.prepare('DELETE FROM unit_queue WHERE id = ?').run(item.id);
      } else {
        db.prepare('UPDATE unit_queue SET count = ?, next_ends_at = ? WHERE id = ?').run(
          remaining,
          nextEnds,
          item.id
        );
        break; // Queue is strictly sequential
      }
    } else {
      break;
    }
  }

  if (dirty) {
    db.prepare(
      'UPDATE bases SET steel = ?, munition = ?, fuel = ?, buildings_json = ?, units_json = ?, defenses_json = ?, updated_at = ? WHERE id = ?'
    ).run(
      steel,
      munition,
      fuel,
      JSON.stringify(buildings),
      JSON.stringify(units),
      JSON.stringify(defenses),
      now,
      baseId
    );
  }

  if (pointsChanged) {
    recalculatePoints(row.user_id);
  }

  // Re-read active queues
  const activeBq = db.prepare('SELECT * FROM build_queue WHERE base_id = ?').get(baseId) as
    | {
        id: number;
        base_id: number;
        building_id: BuildingId;
        target_level: number;
        started_at: number;
        ends_at: number;
      }
    | undefined;

  const activeUq = (
    db.prepare('SELECT * FROM unit_queue WHERE base_id = ? ORDER BY id ASC').all(baseId) as Array<{
      id: number;
      base_id: number;
      entity_type: 'unit' | 'defense';
      entity_id: CombatEntityId;
      count: number;
      unit_duration_sec: number;
      started_at: number;
      next_ends_at: number;
    }>
  ).map<UnitQueueItem>((q) => ({
    id: q.id,
    baseId: q.base_id,
    entityType: q.entity_type,
    entityId: q.entity_id,
    count: q.count,
    unitDurationSec: q.unit_duration_sec,
    startedAt: q.started_at,
    nextEndsAt: q.next_ends_at,
  }));

  const prod = getEffectiveProduction(buildings);
  const storage = getBaseStorage(buildings);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sector: row.sector,
    position: row.position,
    isHome: row.is_home === 1,
    resources: {
      steel: Math.floor(steel),
      munition: Math.floor(munition),
      fuel: Math.floor(fuel),
    },
    storage,
    productionPerHour: prod.production,
    energyProduced: prod.energyProduced,
    energyConsumed: prod.energyConsumed,
    energyEfficiency: prod.energyEfficiency,
    buildings,
    units,
    defenses,
    buildQueue: activeBq
      ? {
          id: activeBq.id,
          baseId: activeBq.base_id,
          buildingId: activeBq.building_id,
          targetLevel: activeBq.target_level,
          startedAt: activeBq.started_at,
          endsAt: activeBq.ends_at,
        }
      : null,
    unitQueue: activeUq,
    updatedAt: now,
  };
}

export function syncUserResearch(userId: number, now: number = Date.now()) {
  const rq = db.prepare('SELECT * FROM research_queue WHERE user_id = ?').get(userId) as
    | {
        id: number;
        user_id: number;
        base_id: number;
        research_id: ResearchId;
        target_level: number;
        started_at: number;
        ends_at: number;
      }
    | undefined;

  const levels = getUserResearch(userId);
  if (rq && rq.ends_at <= now) {
    levels[rq.research_id] = rq.target_level;
    db.prepare('UPDATE user_research SET levels_json = ? WHERE user_id = ?').run(
      JSON.stringify(levels),
      userId
    );
    db.prepare('DELETE FROM research_queue WHERE id = ?').run(rq.id);
    recalculatePoints(userId);
    return { levels, queue: null };
  }

  return {
    levels,
    queue: rq
      ? {
          id: rq.id,
          userId: rq.user_id,
          baseId: rq.base_id,
          researchId: rq.research_id,
          targetLevel: rq.target_level,
          startedAt: rq.started_at,
          endsAt: rq.ends_at,
        }
      : null,
  };
}

export function recalculatePoints(userId: number): void {
  const bases = db
    .prepare('SELECT buildings_json, units_json, defenses_json FROM bases WHERE user_id = ?')
    .all(userId) as Array<{
    buildings_json: string;
    units_json: string;
    defenses_json: string;
  }>;

  let bCost = 0;
  let mCost = 0;

  for (const b of bases) {
    const bld = parseBuildings(b.buildings_json);
    for (const id of BUILDING_ORDER) {
      const lvl = bld[id] || 0;
      for (let i = 1; i <= lvl; i++) {
        const c = getBuildingCost(id, i);
        bCost += c.steel + c.munition + c.fuel;
      }
    }
    const units = parseUnits(b.units_json);
    for (const id of UNIT_ORDER) {
      const cnt = units[id] || 0;
      if (cnt > 0) {
        const c = UNITS[id].cost;
        mCost += (c.steel + c.munition + c.fuel) * cnt;
      }
    }
    const defs = parseDefenses(b.defenses_json);
    for (const id of DEFENSE_ORDER) {
      const cnt = defs[id] || 0;
      if (cnt > 0) {
        const c = DEFENSES[id].cost;
        mCost += (c.steel + c.munition + c.fuel) * cnt;
      }
    }
  }

  // Also include units currently out on missions!
  const missions = db
    .prepare('SELECT units_json FROM missions WHERE user_id = ?')
    .all(userId) as Array<{ units_json: string }>;
  for (const m of missions) {
    const u = JSON.parse(m.units_json) as Partial<Record<UnitId, number>>;
    for (const [id, cnt] of Object.entries(u) as [UnitId, number][]) {
      if (cnt > 0 && id in UNITS) {
        const c = UNITS[id].cost;
        mCost += (c.steel + c.munition + c.fuel) * cnt;
      }
    }
  }

  const res = getUserResearch(userId);
  let rCost = 0;
  for (const id of RESEARCH_ORDER) {
    const lvl = res[id] || 0;
    for (let i = 1; i <= lvl; i++) {
      const c = getResearchCost(id, i);
      rCost += c.steel + c.munition + c.fuel;
    }
  }

  const buildingPoints = Math.floor(bCost / 1000);
  const researchPoints = Math.floor(rCost / 1000);
  const militaryPoints = Math.floor(mCost / 1000);
  const totalPoints = buildingPoints + researchPoints + militaryPoints;

  db.prepare(
    'UPDATE users SET building_points = ?, research_points = ?, military_points = ?, total_points = ? WHERE id = ?'
  ).run(buildingPoints, researchPoints, militaryPoints, totalPoints, userId);
}

interface MissionRow {
  id: number;
  user_id: number;
  origin_base_id: number;
  target_sector: number;
  target_position: number;
  mission_type: MissionType;
  units_json: string;
  cargo_json: string;
  departed_at: number;
  arrives_at: number;
  returns_at: number | null;
  status: 'outbound' | 'returning';
}

export function processDueMissions(now: number = Date.now()): void {
  // 1. Outbound missions that arrived
  const arrived = db
    .prepare("SELECT * FROM missions WHERE status = 'outbound' AND arrives_at <= ? ORDER BY arrives_at ASC")
    .all(now) as unknown as MissionRow[];

  for (const m of arrived) {
    resolveOutboundMission(m, now);
  }

  // 2. Returning missions that reached home base
  const returned = db
    .prepare("SELECT * FROM missions WHERE status = 'returning' AND returns_at IS NOT NULL AND returns_at <= ? ORDER BY returns_at ASC")
    .all(now) as unknown as MissionRow[];

  for (const m of returned) {
    resolveReturningMission(m, now);
  }
}

function resolveOutboundMission(m: MissionRow, now: number): void {
  const units = JSON.parse(m.units_json) as Partial<Record<UnitId, number>>;
  const cargo = JSON.parse(m.cargo_json) as Resources;
  const travelDuration = m.arrives_at - m.departed_at;
  const coords = `[${m.target_sector}:${m.target_position}]`;

  const targetRow = db
    .prepare('SELECT id, user_id, name FROM bases WHERE sector = ? AND position = ?')
    .get(m.target_sector, m.target_position) as
    | { id: number; user_id: number; name: string }
    | undefined;

  const senderUser = db
    .prepare('SELECT username FROM users WHERE id = ?')
    .get(m.user_id) as { username: string } | undefined;
  const senderName = senderUser?.username || 'Kommandant';

  // --- COLONIZE ---
  if (m.mission_type === 'colonize') {
    const research = getUserResearch(m.user_id);
    const maxBases = getMaxBases(research.colonization);
    const currentCount = (
      db.prepare('SELECT COUNT(*) as c FROM bases WHERE user_id = ?').get(m.user_id) as { c: number }
    ).c;

    if (targetRow || currentCount >= maxBases) {
      sendMessage(
        m.user_id,
        'system',
        `Einnahme fehlgeschlagen ${coords}`,
        targetRow
          ? `Position ${coords} ist bereits von einem anderen Stützpunkt besetzt. Der Verband kehrt zurück.`
          : `Maximale Stützpunkt-Kapazität (${maxBases}) erreicht. Erforsche Logistik-Kolonisierung weiter. Der Verband kehrt zurück.`,
        null,
        m.arrives_at
      );
      db.prepare("UPDATE missions SET status = 'returning', returns_at = ? WHERE id = ?").run(
        m.arrives_at + travelDuration,
        m.id
      );
      return;
    }

    const newBaseBuildings = emptyBuildings();
    const newBaseUnits = emptyUnits();
    for (const [uId, cnt] of Object.entries(units) as [UnitId, number][]) {
      if (cnt > 0) newBaseUnits[uId] = cnt;
    }

    db.prepare(
      `INSERT INTO bases (user_id, name, sector, position, is_home, steel, munition, fuel, buildings_json, units_json, defenses_json, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.user_id,
      `Vorposten ${m.target_sector}-${m.target_position}`,
      m.target_sector,
      m.target_position,
      800 + cargo.steel,
      500 + cargo.munition,
      250 + cargo.fuel,
      JSON.stringify(newBaseBuildings),
      JSON.stringify(newBaseUnits),
      JSON.stringify(emptyDefenses()),
      now
    );

    db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);
    recalculatePoints(m.user_id);
    sendMessage(
      m.user_id,
      'system',
      `Neuer Stützpunkt errichtet ${coords}`,
      `Dein Verband hat Position ${coords} erfolgreich gesichert und „Vorposten ${m.target_sector}-${m.target_position}“ errichtet!`,
      null,
      m.arrives_at
    );
    return;
  }

  // If target position is empty for spy/attack/transport/deploy -> return
  if (!targetRow) {
    sendMessage(
      m.user_id,
      'system',
      `Zielposition leer ${coords}`,
      `Am Zielpunkt ${coords} befindet sich kein Stützpunkt. Dein Verband kehrt unverrichteter Dinge zurück.`,
      null,
      m.arrives_at
    );
    db.prepare("UPDATE missions SET status = 'returning', returns_at = ? WHERE id = ?").run(
      m.arrives_at + travelDuration,
      m.id
    );
    return;
  }

  const targetState = syncBase(targetRow.id, m.arrives_at);
  if (!targetState) {
    db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);
    return;
  }

  const targetOwner = db
    .prepare('SELECT username, is_ai FROM users WHERE id = ?')
    .get(targetRow.user_id) as { username: string; is_ai: number };

  // --- TRANSPORT ---
  if (m.mission_type === 'transport') {
    db.prepare('UPDATE bases SET steel = steel + ?, munition = munition + ?, fuel = fuel + ? WHERE id = ?').run(
      cargo.steel,
      cargo.munition,
      cargo.fuel,
      targetRow.id
    );
    db.prepare("UPDATE missions SET status = 'returning', cargo_json = ?, returns_at = ? WHERE id = ?").run(
      JSON.stringify({ steel: 0, munition: 0, fuel: 0 }),
      m.arrives_at + travelDuration,
      m.id
    );

    sendMessage(
      m.user_id,
      'transport',
      `Nachschub geliefert nach ${targetState.name} ${coords}`,
      `Geliefert: ${cargo.steel.toLocaleString('de-DE')} Stahl, ${cargo.munition.toLocaleString('de-DE')} Munition, ${cargo.fuel.toLocaleString('de-DE')} Treibstoff. Konvoi befindet sich auf dem Rückmarsch.`,
      { coords, cargo },
      m.arrives_at
    );
    if (targetRow.user_id !== m.user_id && !targetOwner.is_ai) {
      sendMessage(
        targetRow.user_id,
        'transport',
        `Nachschub von ${senderName} erhalten`,
        `Nachschub bei ${targetState.name} ${coords}: ${cargo.steel.toLocaleString('de-DE')} Stahl, ${cargo.munition.toLocaleString('de-DE')} Munition, ${cargo.fuel.toLocaleString('de-DE')} Treibstoff.`,
        { coords, cargo },
        m.arrives_at
      );
    }
    return;
  }

  // --- DEPLOY (Stationieren) ---
  if (m.mission_type === 'deploy') {
    if (targetRow.user_id !== m.user_id) {
      sendMessage(
        m.user_id,
        'system',
        `Stationierung abgebrochen ${coords}`,
        `Stationieren ist nur auf eigenen Stützpunkten möglich. Der Verband kehrt zurück.`,
        null,
        m.arrives_at
      );
      db.prepare("UPDATE missions SET status = 'returning', returns_at = ? WHERE id = ?").run(
        m.arrives_at + travelDuration,
        m.id
      );
      return;
    }

    const updatedUnits = { ...targetState.units };
    for (const [uId, cnt] of Object.entries(units) as [UnitId, number][]) {
      if (cnt > 0) updatedUnits[uId] = (updatedUnits[uId] || 0) + cnt;
    }

    db.prepare(
      'UPDATE bases SET steel = steel + ?, munition = munition + ?, fuel = fuel + ?, units_json = ? WHERE id = ?'
    ).run(cargo.steel, cargo.munition, cargo.fuel, JSON.stringify(updatedUnits), targetRow.id);
    db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);

    sendMessage(
      m.user_id,
      'transport',
      `Verband stationiert in ${targetState.name} ${coords}`,
      `Alle Einheiten und mitgeführten Vorräte wurden dauerhaft in ${targetState.name} ${coords} stationiert.`,
      { coords, units, cargo },
      m.arrives_at
    );
    return;
  }

  // --- SPY (Aufklären) ---
  if (m.mission_type === 'spy') {
    const atkRes = getUserResearch(m.user_id);
    const defRes = getUserResearch(targetRow.user_id);
    const reconUnits = (Object.entries(units) as [UnitId, number][]).reduce(
      (sum, [uId, cnt]) => sum + (UNITS[uId]?.specialRole === 'recon' ? cnt : 0),
      0
    );
    const scoutsSent = Math.max(1, reconUnits);
    const radarBonus = targetState.buildings.radar_station || 0;
    const intelDiff =
      atkRes.radio_intel + Math.floor(Math.log2(scoutsSent + 1)) - (defRes.radio_intel + Math.floor(radarBonus / 2));

    const spyData: SpyReportData = {
      targetName: targetState.name,
      ownerName: targetOwner.username,
      coords,
      intelLevel: intelDiff,
      resources: targetState.resources,
    };

    if (intelDiff >= -1) {
      spyData.units = targetState.units;
    }
    if (intelDiff >= 0) {
      spyData.defenses = targetState.defenses;
    }
    if (intelDiff >= 1) {
      spyData.buildings = targetState.buildings;
    }
    if (intelDiff >= 2) {
      spyData.research = defRes;
    }

    sendMessage(
      m.user_id,
      'spy',
      `Aufklärungsbericht: ${targetState.name} ${coords}`,
      `Spähverband meldet Lage bei ${targetState.name} (${targetOwner.username}) ${coords}. Rohstoffe gesichtet: ${targetState.resources.steel.toLocaleString('de-DE')} Stahl, ${targetState.resources.munition.toLocaleString('de-DE')} Munition, ${targetState.resources.fuel.toLocaleString('de-DE')} Treibstoff.`,
      spyData,
      m.arrives_at
    );

    if (!targetOwner.is_ai && targetRow.user_id !== m.user_id) {
      sendMessage(
        targetRow.user_id,
        'spy',
        `Feindliche Aufklärung bei ${targetState.name} ${coords}`,
        `Radar meldet Spähfahrzeuge von ${senderName} im Luftraum/Vorfeld von ${targetState.name} ${coords}.`,
        null,
        m.arrives_at
      );
    }

    db.prepare("UPDATE missions SET status = 'returning', returns_at = ? WHERE id = ?").run(
      m.arrives_at + travelDuration,
      m.id
    );
    return;
  }

  // --- ATTACK or CONQUER (Angreifen / Provinz erobern) ---
  if (m.mission_type === 'attack' || m.mission_type === 'conquer') {
    const atkRes = getUserResearch(m.user_id);
    const defRes = getUserResearch(targetRow.user_id);
    const atkUser = db
      .prepare('SELECT faction FROM users WHERE id = ?')
      .get(m.user_id) as { faction: FactionId } | undefined;
    const defUser = db
      .prepare('SELECT faction FROM users WHERE id = ?')
      .get(targetRow.user_id) as { faction: FactionId } | undefined;

    const atkFac = FACTIONS[atkUser?.faction || 'mitteleuropa'] || FACTIONS.mitteleuropa;
    const defFac = FACTIONS[defUser?.faction || 'mitteleuropa'] || FACTIONS.mitteleuropa;
    const targetProv = getProvinceByCoords(m.target_sector, m.target_position);
    const provDefBonus = targetProv?.bonus.type === 'defense' ? targetProv.bonus.percent / 10 : 0;

    const sim = simulateCombat({
      attackerName: senderName,
      defenderName: `${targetState.name} (${targetOwner.username})`,
      targetCoords: coords,
      attackerUnits: units,
      defenderUnits: targetState.units,
      defenderDefenses: targetState.defenses,
      attackerTech: {
        weapons: atkRes.weapons_tech + Math.round(atkFac.bonuses.attack * 10),
        armor: atkRes.armor_tech + Math.round(atkFac.bonuses.armor * 10),
      },
      defenderTech: {
        weapons: defRes.weapons_tech + Math.round((defFac.bonuses.defense + defFac.bonuses.attack) * 5),
        armor: defRes.armor_tech + Math.round((defFac.bonuses.armor + defFac.bonuses.defense) * 10 + provDefBonus),
      },
      defenderResources: targetState.resources,
    });

    const outcomeLabel =
      sim.report.outcome === 'attacker_win'
        ? 'SIEG'
        : sim.report.outcome === 'defender_win'
          ? 'NIEDERLAGE'
          : 'UNENTSCHIEDEN';

    // Check if territorial conquest succeeds!
    let conquered = false;
    if (m.mission_type === 'conquer' && sim.report.outcome === 'attacker_win') {
      const maxBases = getMaxBases(atkRes.colonization);
      const attackerBasesCount = (
        db.prepare('SELECT COUNT(*) as c FROM bases WHERE user_id = ?').get(m.user_id) as { c: number }
      ).c;
      const defenderBasesCount = (
        db.prepare('SELECT COUNT(*) as c FROM bases WHERE user_id = ?').get(targetRow.user_id) as { c: number }
      ).c;
      const canAnnex =
        attackerBasesCount < maxBases &&
        (targetOwner.is_ai === 1 || defenderBasesCount > 1);

      if (canAnnex) {
        conquered = true;
        const garrisonUnits = { ...emptyUnits(), ...sim.attackerSurvivingUnits };
        const provLabel = targetProv ? targetProv.name : targetState.name;
        db.prepare(
          `UPDATE bases
           SET user_id = ?, name = ?, is_home = 0,
               steel = steel + ?, munition = munition + ?, fuel = fuel + ?,
               units_json = ?, defenses_json = ?
           WHERE id = ?`
        ).run(
          m.user_id,
          provLabel,
          cargo.steel,
          cargo.munition,
          cargo.fuel,
          JSON.stringify(garrisonUnits),
          JSON.stringify(emptyDefenses()),
          targetRow.id
        );
        db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);

        sendMessage(
          m.user_id,
          'combat',
          `PROVINZ EROBERT: ${provLabel} ${coords}`,
          `Sieg über ${targetOwner.username}! Deine Truppen haben ${provLabel} ${coords} eingenommen und unter deine Kontrolle gestellt.`,
          sim.report,
          m.arrives_at
        );
        if (!targetOwner.is_ai && targetRow.user_id !== m.user_id) {
          sendMessage(
            targetRow.user_id,
            'combat',
            `PROVINZ VERLOREN: ${provLabel} ${coords}`,
            `${senderName} hat deine Provinz ${provLabel} ${coords} erobert!`,
            sim.report,
            m.arrives_at
          );
        }
      }
    }

    if (!conquered) {
      // Standard battle result: deduct loot, update surviving units & rebuilt defenses
      const defUnitsFull = { ...emptyUnits(), ...sim.defenderSurvivingUnits };
      const defDefsFull = { ...emptyDefenses(), ...sim.defenderFinalDefenses };

      db.prepare(
        'UPDATE bases SET steel = MAX(0, steel - ?), munition = MAX(0, munition - ?), fuel = MAX(0, fuel - ?), units_json = ?, defenses_json = ? WHERE id = ?'
      ).run(
        sim.report.loot.steel,
        sim.report.loot.munition,
        sim.report.loot.fuel,
        JSON.stringify(defUnitsFull),
        JSON.stringify(defDefsFull),
        targetRow.id
      );

      const extraNote =
        m.mission_type === 'conquer' && sim.report.outcome === 'attacker_win'
          ? ' (Eroberung nicht möglich: Stützpunkt-Limit erreicht oder letzte Heimatbasis des Gegners — Beute wurde gesichert.)'
          : '';

      sendMessage(
        m.user_id,
        'combat',
        `Kampfbericht [${outcomeLabel}]: ${targetState.name} ${coords}`,
        `Gefecht über ${sim.report.rounds.length} Runde(n) bei ${targetState.name} ${coords}. Beute: ${sim.report.loot.steel.toLocaleString('de-DE')} Stahl, ${sim.report.loot.munition.toLocaleString('de-DE')} Munition, ${sim.report.loot.fuel.toLocaleString('de-DE')} Treibstoff.${extraNote}`,
        sim.report,
        m.arrives_at
      );

      if (!targetOwner.is_ai && targetRow.user_id !== m.user_id) {
        sendMessage(
          targetRow.user_id,
          'combat',
          `Angriff auf ${targetState.name} ${coords} (${outcomeLabel})`,
          `${senderName} hat deinen Stützpunkt ${targetState.name} ${coords} angegriffen.`,
          sim.report,
          m.arrives_at
        );
      }

      const totalSurvivors = Object.values(sim.attackerSurvivingUnits).reduce((a, b) => a + (b || 0), 0);
      if (totalSurvivors > 0) {
        const returnCargo: Resources = {
          steel: cargo.steel + sim.report.loot.steel,
          munition: cargo.munition + sim.report.loot.munition,
          fuel: cargo.fuel + sim.report.loot.fuel,
        };
        db.prepare(
          "UPDATE missions SET status = 'returning', units_json = ?, cargo_json = ?, returns_at = ? WHERE id = ?"
        ).run(
          JSON.stringify(sim.attackerSurvivingUnits),
          JSON.stringify(returnCargo),
          m.arrives_at + travelDuration,
          m.id
        );
      } else {
        db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);
      }
    }

    recalculatePoints(m.user_id);
    recalculatePoints(targetRow.user_id);
  }
}

function resolveReturningMission(m: MissionRow, now: number): void {
  const originState = syncBase(m.origin_base_id, now);
  if (!originState) {
    db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);
    return;
  }

  const units = JSON.parse(m.units_json) as Partial<Record<UnitId, number>>;
  const cargo = JSON.parse(m.cargo_json) as Resources;

  const updatedUnits = { ...originState.units };
  for (const [uId, cnt] of Object.entries(units) as [UnitId, number][]) {
    if (cnt > 0) updatedUnits[uId] = (updatedUnits[uId] || 0) + cnt;
  }

  db.prepare(
    'UPDATE bases SET steel = steel + ?, munition = munition + ?, fuel = fuel + ?, units_json = ? WHERE id = ?'
  ).run(cargo.steel, cargo.munition, cargo.fuel, JSON.stringify(updatedUnits), m.origin_base_id);

  db.prepare('DELETE FROM missions WHERE id = ?').run(m.id);
}

export function getActiveMissionsForUser(userId: number): {
  active: FleetMission[];
  incoming: FleetMission[];
} {
  const mapRow = (r: MissionRow & { origin_name: string; origin_sector: number; origin_position: number }): FleetMission => {
    const target = db
      .prepare('SELECT name FROM bases WHERE sector = ? AND position = ?')
      .get(r.target_sector, r.target_position) as { name: string } | undefined;
    return {
      id: r.id,
      userId: r.user_id,
      originBaseId: r.origin_base_id,
      originName: r.origin_name,
      originSector: r.origin_sector,
      originPosition: r.origin_position,
      targetSector: r.target_sector,
      targetPosition: r.target_position,
      targetBaseName: target?.name || 'Freie Position',
      missionType: r.mission_type,
      units: JSON.parse(r.units_json),
      cargo: JSON.parse(r.cargo_json),
      departedAt: r.departed_at,
      arrivesAt: r.arrives_at,
      returnsAt: r.returns_at,
      status: r.status,
    };
  };

  const ownRows = db
    .prepare(
      `SELECT m.*, b.name as origin_name, b.sector as origin_sector, b.position as origin_position
       FROM missions m JOIN bases b ON b.id = m.origin_base_id
       WHERE m.user_id = ? ORDER BY COALESCE(m.returns_at, m.arrives_at) ASC`
    )
    .all(userId) as unknown as Array<MissionRow & { origin_name: string; origin_sector: number; origin_position: number }>;

  const incRows = db
    .prepare(
      `SELECT m.*, ob.name as origin_name, ob.sector as origin_sector, ob.position as origin_position
       FROM missions m
       JOIN bases ob ON ob.id = m.origin_base_id
       JOIN bases tb ON tb.sector = m.target_sector AND tb.position = m.target_position
       WHERE tb.user_id = ? AND m.user_id != ? AND m.status = 'outbound'
       ORDER BY m.arrives_at ASC`
    )
    .all(userId, userId) as unknown as Array<MissionRow & { origin_name: string; origin_sector: number; origin_position: number }>;

  return {
    active: ownRows.map(mapRow),
    incoming: incRows.map(mapRow),
  };
}
