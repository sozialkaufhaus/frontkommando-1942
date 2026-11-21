import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  BUILDINGS,
  DEFENSES,
  MAX_SECTORS,
  POSITIONS_PER_SECTOR,
  RESEARCH,
  UNITS,
  checkPrerequisites,
  getBuildingCost,
  getBuildingDurationSec,
  getFleetTravelStats,
  getMaxBases,
  getMaxSimultaneousMissions,
  getResearchCost,
  getResearchDurationSec,
  getUnitDurationSec,
} from '../shared/gameData';
import {
  FACTIONS,
  PROVINCES,
  type FactionId,
} from '../shared/worldMap';
import { TUTORIAL_STEPS } from '../shared/tutorial';
import type {
  AllianceInfo,
  AllianceMember,
  BaseSummary,
  BuildingId,
  ChatMessage,
  CombatEntityId,
  DefenseId,
  DiplomaticPact,
  GameMessage,
  GameStateResponse,
  HighscoreEntry,
  MissionType,
  PactType,
  PlayerListItem,
  ResearchId,
  ResourceType,
  Resources,
  SectorSlot,
  TradeOffer,
  UnitId,
  WorldProvinceState,
} from '../shared/types';
import { db, initDatabase } from './db';
import {
  emptyBuildings,
  emptyDefenses,
  emptyResearch,
  emptyUnits,
  getActiveMissionsForUser,
  getUserResearch,
  processDueMissions,
  recalculatePoints,
  sendMessage,
  syncBase,
  syncUserResearch,
} from './engine';
import {
  broadcastChatMessage,
  getOnlineCount,
  isUserOnline,
  notifyUser,
  registerSseClient,
} from './realtime';
import { findFreeHomeSlot, seedAiSectors } from './seed';

initDatabase();
seedAiSectors();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now()
  );
  return token;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Nicht angemeldet.' });
    return;
  }
  const token = auth.slice(7).trim();
  const row = db
    .prepare(
      `SELECT s.user_id, u.username FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as { user_id: number; username: string } | undefined;

  if (!row) {
    res.status(401).json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
    return;
  }
  req.userId = row.user_id;
  req.username = row.username;
  next();
}

function createNewCommanderAccount(
  username: string,
  passwordHash: string,
  isQuickstart: boolean,
  faction: FactionId = 'mitteleuropa'
): { userId: number; token: string } {
  const safeFaction: FactionId = faction in FACTIONS ? faction : 'mitteleuropa';
  const now = Date.now();
  const slot = findFreeHomeSlot(safeFaction);

  const res = db
    .prepare(
      `INSERT INTO users (username, password_hash, commander_title, faction, is_ai, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run(username, passwordHash, isQuickstart ? 'Oberstleutnant' : 'Major', safeFaction, now);
  const userId = Number(res.lastInsertRowid);

  const research = emptyResearch();
  if (isQuickstart) {
    research.engine_tech = 1;
    research.radio_intel = 1;
    research.colonization = 1; // Ready to expand to a 2nd province!
  }
  db.prepare('INSERT INTO user_research (user_id, levels_json) VALUES (?, ?)').run(
    userId,
    JSON.stringify(research)
  );

  const buildings = emptyBuildings();
  if (isQuickstart) {
    buildings.steel_mill = 3;
    buildings.munition_factory = 2;
    buildings.refinery = 1;
    buildings.power_plant = 4;
    buildings.hq = 2;
    buildings.tank_works = 1;
    buildings.research_lab = 1;
  }

  const units = emptyUnits();
  if (isQuickstart) {
    units.scout_car = 3;
    units.truck_convoy = 2;
    units.infantry = 8;
  } else {
    units.scout_car = 1;
    units.infantry = 2;
  }

  const defenses = emptyDefenses();
  if (isQuickstart) {
    defenses.mg_nest = 2;
  }

  const homeName = slot.provinceName || `Hauptquartier ${slot.sector}-${slot.position}`;

  db.prepare(
    `INSERT INTO bases (user_id, name, sector, position, is_home, steel, munition, fuel, buildings_json, units_json, defenses_json, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    homeName,
    slot.sector,
    slot.position,
    isQuickstart ? 4500 : 1800,
    isQuickstart ? 2800 : 1200,
    isQuickstart ? 1400 : 500,
    JSON.stringify(buildings),
    JSON.stringify(units),
    JSON.stringify(defenses),
    now
  );

  recalculatePoints(userId);
  sendMessage(
    userId,
    'system',
    `Willkommen im Oberkommando — ${FACTIONS[safeFaction].name}`,
    `Kommandant ${username}, deine Heimatprovinz „${homeName}“ [${slot.sector}:${slot.position}] steht unter deinem Befehl. Öffne die Europa-Karte, baue deinen Stützpunkt aus und erweitere dein Staatsgebiet durch Eroberung oder Einnahme freier Provinzen!`,
    null,
    now
  );

  const token = createSession(userId);
  return { userId, token };
}

// ================= AUTH ROUTES =================

app.post('/api/auth/register', (req, res) => {
  try {
    const rawUser = String(req.body?.username || '').trim();
    const rawPass = String(req.body?.password || '');

    if (rawUser.length < 3 || rawUser.length > 24) {
      res.status(400).json({ error: 'Kommandantenname muss 3–24 Zeichen lang sein.' });
      return;
    }
    if (rawPass.length < 4) {
      res.status(400).json({ error: 'Passwort muss mindestens 4 Zeichen lang sein.' });
      return;
    }

    const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(rawUser);
    if (exists) {
      res.status(409).json({ error: 'Dieser Kommandantenname ist bereits vergeben.' });
      return;
    }

    const faction = String(req.body?.faction || 'mitteleuropa') as FactionId;
    const hash = bcrypt.hashSync(rawPass, 8);
    const { token } = createNewCommanderAccount(rawUser, hash, false, faction);
    res.json({ token, username: rawUser });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const rawUser = String(req.body?.username || '').trim();
    const rawPass = String(req.body?.password || '');

    const user = db
      .prepare('SELECT id, username, password_hash, is_ai FROM users WHERE LOWER(username) = LOWER(?)')
      .get(rawUser) as { id: number; username: string; password_hash: string; is_ai: number } | undefined;

    if (!user || user.is_ai === 1 || !bcrypt.compareSync(rawPass, user.password_hash)) {
      res.status(401).json({ error: 'Ungültiger Kommandantenname oder falsches Passwort.' });
      return;
    }

    const token = createSession(user.id);
    res.json({ token, username: user.username });
  } catch {
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' });
  }
});

app.post('/api/auth/quickstart', (req, res) => {
  try {
    const faction = String(req.body?.faction || 'mitteleuropa') as FactionId;
    const suffix = Math.floor(100 + Math.random() * 900);
    const username = `Kommandant-${suffix}`;
    const hash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 6);
    const { token } = createNewCommanderAccount(username, hash, true, faction);
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Schnellstart fehlgeschlagen.' });
  }
});

app.post('/api/auth/logout', authMiddleware, (req: AuthRequest, res) => {
  const token = req.headers.authorization?.slice(7).trim();
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

// ================= GOOGLE OAUTH SIGN-IN =================

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();

app.get('/api/auth/providers', (_req, res) => {
  res.json({
    googleEnabled: Boolean(GOOGLE_CLIENT_ID),
    googleClientId: GOOGLE_CLIENT_ID || null,
  });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      res.status(503).json({
        error:
          'Google-Anmeldung ist auf diesem Server noch nicht konfiguriert (Umgebungsvariable GOOGLE_CLIENT_ID fehlt).',
      });
      return;
    }

    const credential = String(req.body?.credential || '').trim();
    const faction = String(req.body?.faction || 'mitteleuropa') as FactionId;
    if (!credential) {
      res.status(400).json({ error: 'Kein Google-Token übermittelt.' });
      return;
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Ungültiges oder abgelaufenes Google-Token.' });
      return;
    }

    const payload = (await verifyRes.json()) as {
      sub?: string;
      aud?: string;
      email?: string;
      name?: string;
      given_name?: string;
    };

    if (!payload.sub || payload.aud !== GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: 'Google-Token stimmt nicht mit der Client-ID überein.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, username FROM users WHERE google_sub = ?')
      .get(payload.sub) as { id: number; username: string } | undefined;

    if (existing) {
      const token = createSession(existing.id);
      res.json({ token, username: existing.username, isNew: false });
      return;
    }

    // Create unique commander name from Google profile
    const rawBase = (payload.given_name || payload.name || payload.email?.split('@')[0] || 'Kommandant')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 16) || 'Kommandant';
    let candidate = rawBase;
    let attempt = 0;
    while (db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(candidate)) {
      attempt++;
      candidate = `${rawBase}_${Math.floor(10 + Math.random() * 89 + attempt)}`;
    }

    const randomHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 6);
    const { userId, token } = createNewCommanderAccount(candidate, randomHash, false, faction);
    db.prepare('UPDATE users SET google_sub = ?, email = ? WHERE id = ?').run(
      payload.sub,
      payload.email || null,
      userId
    );

    res.json({ token, username: candidate, isNew: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Google-Anmeldung fehlgeschlagen.',
    });
  }
});

function isTutorialStepSatisfied(
  step: number,
  userId: number,
  activeBase: ReturnType<typeof syncBase>,
  research: Record<ResearchId, number>,
  basesCount: number,
  activeMissions: ReturnType<typeof getActiveMissionsForUser>['active']
): boolean {
  if (!activeBase) return false;
  switch (step) {
    case 0:
      return activeBase.buildings.steel_mill >= 4 && activeBase.energyEfficiency >= 1;
    case 1: {
      const totalRes = Object.values(research).reduce((a, b) => a + (b || 0), 0);
      return totalRes >= 3;
    }
    case 2: {
      const totalUnits = Object.values(activeBase.units).reduce((a, b) => a + (b || 0), 0);
      return totalUnits >= 12;
    }
    case 3: {
      const hasSpyMsg =
        (
          db
            .prepare("SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND type = 'spy'")
            .get(userId) as { c: number }
        ).c > 0;
      const hasSpyMission = activeMissions.some((m) => m.missionType === 'spy');
      return hasSpyMsg || hasSpyMission;
    }
    case 4: {
      const hasCombatMsg =
        (
          db
            .prepare("SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND type = 'combat'")
            .get(userId) as { c: number }
        ).c > 0;
      return hasCombatMsg;
    }
    case 5:
      return basesCount >= 2;
    default:
      return false;
  }
}

// ================= GAME STATE =================

app.get('/api/state', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  processDueMissions(now);

  const userId = req.userId!;
  const basesRows = db
    .prepare('SELECT id, name, sector, position, is_home FROM bases WHERE user_id = ? ORDER BY is_home DESC, id ASC')
    .all(userId) as Array<{ id: number; name: string; sector: number; position: number; is_home: number }>;

  if (basesRows.length === 0) {
    res.status(404).json({ error: 'Kein Stützpunkt gefunden.' });
    return;
  }

  const requestedBaseId = Number(req.query.baseId);
  const chosenBase =
    basesRows.find((b) => b.id === requestedBaseId) || basesRows[0];

  // Sync active base & research
  const activeBase = syncBase(chosenBase.id, now);
  if (!activeBase) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }

  const { levels: research, queue: researchQueue } = syncUserResearch(userId, now);
  const { active: activeMissions, incoming: incomingMissions } = getActiveMissionsForUser(userId);

  const userRow = db
    .prepare(
      `SELECT u.id, u.username, u.commander_title, u.faction, u.total_points, u.alliance_id,
              u.tutorial_step, u.tutorial_dismissed,
              a.tag as alliance_tag, a.name as alliance_name
       FROM users u
       LEFT JOIN alliances a ON a.id = u.alliance_id
       WHERE u.id = ?`
    )
    .get(userId) as {
    id: number;
    username: string;
    commander_title: string;
    faction: FactionId;
    total_points: number;
    alliance_id: number | null;
    tutorial_step: number;
    tutorial_dismissed: number;
    alliance_tag: string | null;
    alliance_name: string | null;
  };

  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, userId);

  const unread = (
    db.prepare('SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND is_read = 0').get(userId) as {
      c: number;
    }
  ).c;

  const bases: BaseSummary[] = basesRows.map((b) => ({
    id: b.id,
    name: b.name,
    sector: b.sector,
    position: b.position,
    isHome: b.is_home === 1,
  }));

  const currentStep = userRow.tutorial_step || 0;
  const completed = currentStep >= TUTORIAL_STEPS.length;
  const stepReadyToClaim =
    !completed &&
    isTutorialStepSatisfied(
      currentStep,
      userId,
      activeBase,
      research,
      bases.length,
      activeMissions
    );

  const payload: GameStateResponse = {
    serverTime: now,
    onlineCount: Math.max(1, getOnlineCount()),
    tutorial: {
      currentStep,
      totalSteps: TUTORIAL_STEPS.length,
      completed,
      stepReadyToClaim,
      dismissed: userRow.tutorial_dismissed === 1,
    },
    user: {
      id: userRow.id,
      username: userRow.username,
      commanderTitle: userRow.commander_title,
      faction: userRow.faction || 'mitteleuropa',
      points: userRow.total_points,
      unreadMessages: unread,
      allianceId: userRow.alliance_id,
      allianceTag: userRow.alliance_tag,
      allianceName: userRow.alliance_name,
    },
    bases,
    activeBase,
    research,
    researchQueue,
    activeMissions,
    incomingMissions,
  };

  res.json(payload);
});

// ================= BASE ACTIONS =================

app.post('/api/bases/:baseId/rename', authMiddleware, (req: AuthRequest, res) => {
  const baseId = Number(req.params.baseId);
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 28) {
    res.status(400).json({ error: 'Stützpunktname muss 2–28 Zeichen lang sein.' });
    return;
  }
  const result = db
    .prepare('UPDATE bases SET name = ? WHERE id = ? AND user_id = ?')
    .run(name, baseId, req.userId!);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/bases/:baseId/build', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const baseId = Number(req.params.baseId);
  const buildingId = String(req.body?.buildingId || '') as BuildingId;

  if (!(buildingId in BUILDINGS)) {
    res.status(400).json({ error: 'Unbekanntes Gebäude.' });
    return;
  }

  const base = syncBase(baseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }

  if (base.buildQueue) {
    res.status(409).json({ error: 'In diesem Stützpunkt läuft bereits ein Bauauftrag.' });
    return;
  }

  const research = getUserResearch(req.userId!);
  const check = checkPrerequisites(BUILDINGS[buildingId].prereq, base.buildings, research);
  if (!check.met) {
    res.status(400).json({ error: `Voraussetzungen fehlen: ${check.missing.join(', ')}` });
    return;
  }

  const targetLevel = (base.buildings[buildingId] || 0) + 1;
  const cost = getBuildingCost(buildingId, targetLevel);

  if (
    base.resources.steel < cost.steel ||
    base.resources.munition < cost.munition ||
    base.resources.fuel < cost.fuel
  ) {
    res.status(400).json({ error: 'Nicht genügend Rohstoffe für diesen Ausbau.' });
    return;
  }

  const uFacRow = db.prepare('SELECT faction FROM users WHERE id = ?').get(req.userId!) as
    | { faction: FactionId }
    | undefined;
  const buildSpeedBonus = FACTIONS[uFacRow?.faction || 'mitteleuropa']?.bonuses.buildSpeed || 0;
  const durationSec = Math.max(
    4,
    Math.floor(getBuildingDurationSec(buildingId, targetLevel, base.buildings.hq) * (1 - buildSpeedBonus))
  );
  const endsAt = now + durationSec * 1000;

  db.prepare('UPDATE bases SET steel = steel - ?, munition = munition - ?, fuel = fuel - ? WHERE id = ?').run(
    cost.steel,
    cost.munition,
    cost.fuel,
    baseId
  );

  db.prepare(
    'INSERT INTO build_queue (base_id, building_id, target_level, started_at, ends_at) VALUES (?, ?, ?, ?, ?)'
  ).run(baseId, buildingId, targetLevel, now, endsAt);

  res.json({ ok: true, endsAt, durationSec });
});

app.post('/api/bases/:baseId/build/cancel', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const baseId = Number(req.params.baseId);
  const base = syncBase(baseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }
  if (!base.buildQueue) {
    res.status(400).json({ error: 'Kein laufender Bauauftrag vorhanden.' });
    return;
  }
  const cost = getBuildingCost(base.buildQueue.buildingId, base.buildQueue.targetLevel);
  db.prepare('DELETE FROM build_queue WHERE id = ?').run(base.buildQueue.id);
  db.prepare('UPDATE bases SET steel = steel + ?, munition = munition + ?, fuel = fuel + ? WHERE id = ?').run(
    cost.steel,
    cost.munition,
    cost.fuel,
    baseId
  );
  res.json({ ok: true });
});

app.post('/api/bases/:baseId/research', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const baseId = Number(req.params.baseId);
  const researchId = String(req.body?.researchId || '') as ResearchId;

  if (!(researchId in RESEARCH)) {
    res.status(400).json({ error: 'Unbekannte Forschung.' });
    return;
  }

  const base = syncBase(baseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }

  const { levels, queue } = syncUserResearch(req.userId!, now);
  if (queue) {
    res.status(409).json({ error: 'Es läuft bereits eine aktive Forschung.' });
    return;
  }

  const check = checkPrerequisites(RESEARCH[researchId].prereq, base.buildings, levels);
  if (!check.met) {
    res.status(400).json({ error: `Voraussetzungen fehlen: ${check.missing.join(', ')}` });
    return;
  }

  const targetLevel = (levels[researchId] || 0) + 1;
  const cost = getResearchCost(researchId, targetLevel);

  if (
    base.resources.steel < cost.steel ||
    base.resources.munition < cost.munition ||
    base.resources.fuel < cost.fuel
  ) {
    res.status(400).json({ error: 'Nicht genügend Rohstoffe für diese Forschung.' });
    return;
  }

  const durationSec = getResearchDurationSec(researchId, targetLevel, base.buildings.research_lab);
  const endsAt = now + durationSec * 1000;

  db.prepare('UPDATE bases SET steel = steel - ?, munition = munition - ?, fuel = fuel - ? WHERE id = ?').run(
    cost.steel,
    cost.munition,
    cost.fuel,
    baseId
  );

  db.prepare(
    'INSERT INTO research_queue (user_id, base_id, research_id, target_level, started_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId!, baseId, researchId, targetLevel, now, endsAt);

  res.json({ ok: true, endsAt, durationSec });
});

app.post('/api/bases/:baseId/produce', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const baseId = Number(req.params.baseId);
  const entityType = req.body?.entityType === 'defense' ? 'defense' : 'unit';
  const entityId = String(req.body?.entityId || '') as CombatEntityId;
  const count = Math.floor(Number(req.body?.count || 0));

  if (count < 1 || count > 500) {
    res.status(400).json({ error: 'Anzahl muss zwischen 1 und 500 liegen.' });
    return;
  }

  const def =
    entityType === 'unit'
      ? UNITS[entityId as UnitId]
      : DEFENSES[entityId as DefenseId];

  if (!def) {
    res.status(400).json({ error: 'Unbekannte Einheit oder Verteidigungsanlage.' });
    return;
  }

  const base = syncBase(baseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }

  const research = getUserResearch(req.userId!);
  const check = checkPrerequisites(def.prereq, base.buildings, research);
  if (!check.met) {
    res.status(400).json({ error: `Voraussetzungen fehlen: ${check.missing.join(', ')}` });
    return;
  }

  const totalCost: Resources = {
    steel: def.cost.steel * count,
    munition: def.cost.munition * count,
    fuel: def.cost.fuel * count,
  };

  if (
    base.resources.steel < totalCost.steel ||
    base.resources.munition < totalCost.munition ||
    base.resources.fuel < totalCost.fuel
  ) {
    res.status(400).json({ error: 'Nicht genügend Rohstoffe für diesen Produktionsauftrag.' });
    return;
  }

  const unitDurationSec = getUnitDurationSec(
    entityId,
    base.buildings.tank_works,
    base.buildings.airfield
  );

  // Compute start time after existing queue tail
  let queueEnd = now;
  for (const item of base.unitQueue) {
    const itemFinish = item.nextEndsAt + (item.count - 1) * item.unitDurationSec * 1000;
    if (itemFinish > queueEnd) queueEnd = itemFinish;
  }

  const nextEndsAt = queueEnd + unitDurationSec * 1000;

  db.prepare('UPDATE bases SET steel = steel - ?, munition = munition - ?, fuel = fuel - ? WHERE id = ?').run(
    totalCost.steel,
    totalCost.munition,
    totalCost.fuel,
    baseId
  );

  db.prepare(
    `INSERT INTO unit_queue (base_id, entity_type, entity_id, count, unit_duration_sec, started_at, next_ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(baseId, entityType, entityId, count, unitDurationSec, queueEnd, nextEndsAt);

  res.json({ ok: true, unitDurationSec });
});

// ================= TUTORIAL CAMPAIGN =================

app.post('/api/tutorial/claim', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  processDueMissions(now);
  const userId = req.userId!;
  const baseId = Number(req.body?.baseId);

  const user = db
    .prepare('SELECT tutorial_step FROM users WHERE id = ?')
    .get(userId) as { tutorial_step: number };
  const stepIdx = user.tutorial_step || 0;

  if (stepIdx >= TUTORIAL_STEPS.length) {
    res.status(400).json({ error: 'Einführungsmission bereits abgeschlossen.' });
    return;
  }

  const baseRow = db
    .prepare('SELECT id FROM bases WHERE user_id = ? AND id = ?')
    .get(userId, baseId) as { id: number } | undefined;
  const fallbackBase =
    baseRow ||
    (db.prepare('SELECT id FROM bases WHERE user_id = ? ORDER BY is_home DESC, id ASC LIMIT 1').get(userId) as {
      id: number;
    });

  const activeBase = syncBase(fallbackBase.id, now);
  const { levels: research } = syncUserResearch(userId, now);
  const { active: activeMissions } = getActiveMissionsForUser(userId);
  const basesCount = (
    db.prepare('SELECT COUNT(*) as c FROM bases WHERE user_id = ?').get(userId) as { c: number }
  ).c;

  if (
    !activeBase ||
    !isTutorialStepSatisfied(stepIdx, userId, activeBase, research, basesCount, activeMissions)
  ) {
    res.status(400).json({ error: 'Das Missionsziel ist noch nicht erfüllt.' });
    return;
  }

  const def = TUTORIAL_STEPS[stepIdx];
  const updatedUnits = { ...activeBase.units };
  if (def.rewardUnits) {
    for (const [uId, cnt] of Object.entries(def.rewardUnits) as [UnitId, number][]) {
      if (cnt > 0) updatedUnits[uId] = (updatedUnits[uId] || 0) + cnt;
    }
  }

  db.prepare(
    'UPDATE bases SET steel = steel + ?, munition = munition + ?, fuel = fuel + ?, units_json = ? WHERE id = ?'
  ).run(
    def.rewardResources.steel,
    def.rewardResources.munition,
    def.rewardResources.fuel,
    JSON.stringify(updatedUnits),
    activeBase.id
  );

  const nextStep = stepIdx + 1;
  db.prepare('UPDATE users SET tutorial_step = ? WHERE id = ?').run(nextStep, userId);
  recalculatePoints(userId);

  if (nextStep >= TUTORIAL_STEPS.length) {
    sendMessage(
      userId,
      'system',
      'OPERATION GRUNDSTEIN ABGESCHLOSSEN!',
      'Hervorragende Arbeit, Kommandant! Du hast alle 6 Einführungsmissionen gemeistert und dir volle Gefechtsbereitschaft erarbeitet. Erobere nun weitere Schlüsselprovinzen auf der Europa-Karte!',
      null,
      now
    );
  }

  res.json({ ok: true, nextStep, rewardLabel: def.rewardLabel });
});

app.post('/api/tutorial/dismiss', authMiddleware, (req: AuthRequest, res) => {
  const dismissed = req.body?.dismissed === false ? 0 : 1;
  db.prepare('UPDATE users SET tutorial_dismissed = ? WHERE id = ?').run(dismissed, req.userId!);
  res.json({ ok: true });
});

// ================= WORLD MAP & FACTIONS =================

app.post('/api/user/faction', authMiddleware, (req: AuthRequest, res) => {
  const faction = String(req.body?.faction || '') as FactionId;
  if (!(faction in FACTIONS)) {
    res.status(400).json({ error: 'Unbekannte Fraktion.' });
    return;
  }
  db.prepare('UPDATE users SET faction = ? WHERE id = ?').run(faction, req.userId!);
  res.json({ ok: true, faction });
});

app.get('/api/world', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  processDueMissions(now);

  const rows = db
    .prepare(
      `SELECT b.id, b.name, b.sector, b.position, b.user_id, b.units_json, b.defenses_json,
              u.username, u.faction, u.is_ai, u.ai_difficulty, u.total_points,
              a.tag as alliance_tag
       FROM bases b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN alliances a ON a.id = u.alliance_id`
    )
    .all() as Array<{
    id: number;
    name: string;
    sector: number;
    position: number;
    user_id: number;
    units_json: string;
    defenses_json: string;
    username: string;
    faction: FactionId;
    is_ai: number;
    ai_difficulty: string | null;
    total_points: number;
    alliance_tag: string | null;
  }>;

  const byCoords = new Map(rows.map((r) => [`${r.sector}:${r.position}`, r]));
  const factionCounts: Record<string, number> = {
    mitteleuropa: 0,
    westallianz: 0,
    ostfront: 0,
    nordpakt: 0,
    neutral: 0,
  };

  const provinces: WorldProvinceState[] = PROVINCES.map((prov) => {
    const r = byCoords.get(`${prov.sector}:${prov.position}`);
    if (!r) {
      factionCounts.neutral++;
      return {
        provinceId: prov.id,
        sector: prov.sector,
        position: prov.position,
        baseId: null,
        baseName: null,
        ownerId: null,
        ownerName: null,
        ownerFaction: null,
        allianceTag: null,
        isAi: false,
        isOwn: false,
        isOnline: false,
        points: 0,
        defensePower: 0,
      };
    }

    const fac = r.faction || 'mitteleuropa';
    factionCounts[fac] = (factionCounts[fac] || 0) + 1;

    const uMap = JSON.parse(r.units_json) as Record<string, number>;
    const dMap = JSON.parse(r.defenses_json) as Record<string, number>;
    const totalDefUnits =
      Object.values(uMap).reduce((a, b) => a + (b || 0), 0) +
      Object.values(dMap).reduce((a, b) => a + (b || 0), 0);

    return {
      provinceId: prov.id,
      sector: prov.sector,
      position: prov.position,
      baseId: r.id,
      baseName: r.name,
      ownerId: r.user_id,
      ownerName: r.username,
      ownerFaction: fac,
      allianceTag: r.alliance_tag,
      isAi: r.is_ai === 1,
      isOwn: r.user_id === req.userId,
      isOnline: r.is_ai === 0 && isUserOnline(r.user_id),
      aiDifficulty: r.ai_difficulty || undefined,
      points: r.total_points,
      defensePower: totalDefUnits,
    };
  });

  res.json({ provinces, factionCounts });
});

// ================= SECTORS =================

app.get('/api/sectors/:sector', authMiddleware, (req: AuthRequest, res) => {
  const sector = Number(req.params.sector);
  if (!Number.isInteger(sector) || sector < 1 || sector > MAX_SECTORS) {
    res.status(400).json({ error: `Sektor muss zwischen 1 und ${MAX_SECTORS} liegen.` });
    return;
  }

  const rows = db
    .prepare(
      `SELECT b.id, b.name, b.position, b.user_id, u.username, u.is_ai, u.ai_difficulty, u.total_points,
              a.tag as alliance_tag
       FROM bases b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN alliances a ON a.id = u.alliance_id
       WHERE b.sector = ?`
    )
    .all(sector) as Array<{
    id: number;
    name: string;
    position: number;
    user_id: number;
    username: string;
    is_ai: number;
    ai_difficulty: string | null;
    total_points: number;
    alliance_tag: string | null;
  }>;

  const byPos = new Map(rows.map((r) => [r.position, r]));
  const slots: SectorSlot[] = [];

  for (let pos = 1; pos <= POSITIONS_PER_SECTOR; pos++) {
    const r = byPos.get(pos);
    if (r) {
      slots.push({
        sector,
        position: pos,
        baseId: r.id,
        baseName: r.name,
        ownerName: r.username,
        ownerId: r.user_id,
        allianceTag: r.alliance_tag,
        isOnline: r.is_ai === 0 && isUserOnline(r.user_id),
        isAi: r.is_ai === 1,
        isOwn: r.user_id === req.userId,
        aiDifficulty: r.ai_difficulty || undefined,
        points: r.total_points,
      });
    } else {
      slots.push({
        sector,
        position: pos,
        baseId: null,
        baseName: null,
        ownerName: null,
        ownerId: null,
        isAi: false,
        isOwn: false,
      });
    }
  }

  res.json({ sector, maxSectors: MAX_SECTORS, slots });
});

// ================= MISSIONS =================

app.post('/api/missions', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  processDueMissions(now);

  const originBaseId = Number(req.body?.originBaseId);
  const targetSector = Number(req.body?.targetSector);
  const targetPosition = Number(req.body?.targetPosition);
  const missionType = String(req.body?.missionType || '') as MissionType;
  const rawUnits = (req.body?.units || {}) as Partial<Record<UnitId, number>>;
  const rawCargo = (req.body?.cargo || { steel: 0, munition: 0, fuel: 0 }) as Partial<Resources>;

  if (!['spy', 'attack', 'conquer', 'transport', 'deploy', 'colonize'].includes(missionType)) {
    res.status(400).json({ error: 'Ungültiger Missionstyp.' });
    return;
  }

  if (
    !Number.isInteger(targetSector) ||
    targetSector < 1 ||
    targetSector > MAX_SECTORS ||
    !Number.isInteger(targetPosition) ||
    targetPosition < 1 ||
    targetPosition > POSITIONS_PER_SECTOR
  ) {
    res.status(400).json({ error: 'Ungültige Zielkoordinaten.' });
    return;
  }

  const base = syncBase(originBaseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Ausgangsstützpunkt nicht gefunden.' });
    return;
  }

  if (base.sector === targetSector && base.position === targetPosition) {
    res.status(400).json({ error: 'Zielkoordinaten dürfen nicht identisch mit dem Ausgangsstützpunkt sein.' });
    return;
  }

  const research = getUserResearch(req.userId!);
  const maxSlots = getMaxSimultaneousMissions(research.logistics);
  const activeCount = (
    db.prepare('SELECT COUNT(*) as c FROM missions WHERE user_id = ?').get(req.userId!) as {
      c: number;
    }
  ).c;

  if (activeCount >= maxSlots) {
    res.status(409).json({
      error: `Maximale Anzahl gleichzeitiger Marschverbände (${maxSlots}) erreicht. Erforsche Logistik für weitere Verbände.`,
    });
    return;
  }

  // Validate units
  const unitsToSend: Partial<Record<UnitId, number>> = {};
  let totalUnitCount = 0;
  for (const [uId, val] of Object.entries(rawUnits) as [UnitId, number][]) {
    const cnt = Math.floor(Number(val || 0));
    if (cnt <= 0) continue;
    if (!(uId in UNITS)) {
      res.status(400).json({ error: `Unbekannte Einheit: ${uId}` });
      return;
    }
    if ((base.units[uId] || 0) < cnt) {
      res.status(400).json({ error: `Nicht genügend ${UNITS[uId].name} im Stützpunkt stationiert.` });
      return;
    }
    unitsToSend[uId] = cnt;
    totalUnitCount += cnt;
  }

  if (totalUnitCount === 0) {
    res.status(400).json({ error: 'Mindestens eine Einheit muss entsandt werden.' });
    return;
  }

  if (missionType === 'spy' && !(unitsToSend.scout_car && unitsToSend.scout_car > 0)) {
    res.status(400).json({ error: 'Für Aufklärung muss mindestens ein Spähwagen mitgeführt werden.' });
    return;
  }

  if (missionType === 'colonize') {
    const maxBases = getMaxBases(research.colonization);
    const currentBases = (
      db.prepare('SELECT COUNT(*) as c FROM bases WHERE user_id = ?').get(req.userId!) as { c: number }
    ).c;
    if (currentBases >= maxBases) {
      res.status(400).json({
        error: `Stützpunkt-Limit (${maxBases}) erreicht. Erforsche Logistik-Kolonisierung für weitere Stützpunkte.`,
      });
      return;
    }
    const occupied = db
      .prepare('SELECT id FROM bases WHERE sector = ? AND position = ?')
      .get(targetSector, targetPosition);
    if (occupied) {
      res.status(400).json({ error: 'Diese Sektorposition ist bereits besetzt.' });
      return;
    }
  }

  // Enforce active NAP / Military Alliance protection
  if (missionType === 'attack' || missionType === 'conquer') {
    const targetOwnerRow = db
      .prepare('SELECT b.user_id, u.username FROM bases b JOIN users u ON u.id = b.user_id WHERE b.sector = ? AND b.position = ?')
      .get(targetSector, targetPosition) as { user_id: number; username: string } | undefined;
    if (targetOwnerRow && targetOwnerRow.user_id !== req.userId) {
      const activePact = db
        .prepare(
          `SELECT pact_type FROM diplomatic_pacts
           WHERE status = 'active'
             AND ((requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?))`
        )
        .get(req.userId!, targetOwnerRow.user_id, targetOwnerRow.user_id, req.userId!) as
        | { pact_type: PactType }
        | undefined;
      if (activePact) {
        const label = activePact.pact_type === 'military_alliance' ? 'Militärbündnis' : 'Nichtangriffspakt';
        res.status(409).json({
          error: `Angriff blockiert: Du hast ein aktives ${label} mit ${targetOwnerRow.username}. Kündige den Vertrag zuerst unter „Spieler & Handel“.`,
        });
        return;
      }
    }
  }

  const travel = getFleetTravelStats(
    unitsToSend,
    base.sector,
    base.position,
    targetSector,
    targetPosition,
    research.engine_tech
  );

  const cargo: Resources = {
    steel: Math.max(0, Math.floor(Number(rawCargo.steel || 0))),
    munition: Math.max(0, Math.floor(Number(rawCargo.munition || 0))),
    fuel: Math.max(0, Math.floor(Number(rawCargo.fuel || 0))),
  };

  if (cargo.steel + cargo.munition + cargo.fuel > travel.cargoCapacity) {
    res.status(400).json({ error: 'Ladekapazität des Verbands überschritten.' });
    return;
  }

  if (
    base.resources.steel < cargo.steel ||
    base.resources.munition < cargo.munition ||
    base.resources.fuel < cargo.fuel + travel.fuelCost
  ) {
    res.status(400).json({
      error: `Nicht genügend Rohstoffe oder Treibstoff (benötigt ${travel.fuelCost} Treibstoff für den Marsch).`,
    });
    return;
  }

  // Deduct units, cargo, and fuel
  const remainingUnits = { ...base.units };
  for (const [uId, cnt] of Object.entries(unitsToSend) as [UnitId, number][]) {
    remainingUnits[uId] = Math.max(0, (remainingUnits[uId] || 0) - cnt);
  }

  db.prepare(
    'UPDATE bases SET steel = steel - ?, munition = munition - ?, fuel = fuel - ?, units_json = ? WHERE id = ?'
  ).run(
    cargo.steel,
    cargo.munition,
    cargo.fuel + travel.fuelCost,
    JSON.stringify(remainingUnits),
    originBaseId
  );

  const arrivesAt = now + travel.durationSec * 1000;
  const info = db
    .prepare(
      `INSERT INTO missions (user_id, origin_base_id, target_sector, target_position, mission_type, units_json, cargo_json, departed_at, arrives_at, returns_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'outbound')`
    )
    .run(
      req.userId!,
      originBaseId,
      targetSector,
      targetPosition,
      missionType,
      JSON.stringify(unitsToSend),
      JSON.stringify(cargo),
      now,
      arrivesAt
    );

  // Push real-time radar alert if targeting another human player
  const targetBase = db
    .prepare('SELECT b.user_id, u.is_ai FROM bases b JOIN users u ON u.id = b.user_id WHERE b.sector = ? AND b.position = ?')
    .get(targetSector, targetPosition) as { user_id: number; is_ai: number } | undefined;
  if (targetBase && targetBase.is_ai === 0 && targetBase.user_id !== req.userId) {
    notifyUser(targetBase.user_id, 'incoming', {
      missionType,
      from: req.username,
      targetSector,
      targetPosition,
      arrivesAt,
    });
  }

  res.json({ ok: true, missionId: Number(info.lastInsertRowid), arrivesAt, durationSec: travel.durationSec });
});

app.post('/api/missions/:id/recall', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  processDueMissions(now);
  const id = Number(req.params.id);

  const m = db
    .prepare('SELECT * FROM missions WHERE id = ? AND user_id = ?')
    .get(id, req.userId!) as
    | { id: number; status: string; departed_at: number; arrives_at: number }
    | undefined;

  if (!m) {
    res.status(404).json({ error: 'Marschverband nicht gefunden.' });
    return;
  }
  if (m.status !== 'outbound') {
    res.status(400).json({ error: 'Verband befindet sich bereits auf dem Rückmarsch.' });
    return;
  }

  const elapsed = Math.max(3000, now - m.departed_at);
  const returnsAt = now + elapsed;
  db.prepare("UPDATE missions SET status = 'returning', returns_at = ? WHERE id = ?").run(
    returnsAt,
    id
  );
  res.json({ ok: true, returnsAt });
});

// ================= MESSAGES =================

app.get('/api/messages', authMiddleware, (req: AuthRequest, res) => {
  processDueMissions(Date.now());
  const rows = db
    .prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
    .all(req.userId!) as Array<{
    id: number;
    type: 'combat' | 'spy' | 'transport' | 'system' | 'diplomacy';
    title: string;
    body: string;
    data_json: string | null;
    is_read: number;
    created_at: number;
  }>;

  const messages: GameMessage[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data_json ? JSON.parse(r.data_json) : null,
    isRead: r.is_read === 1,
    createdAt: r.created_at,
  }));

  res.json({ messages });
});

app.post('/api/messages/:id/read', authMiddleware, (req: AuthRequest, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.userId!
  );
  res.json({ ok: true });
});

app.post('/api/messages/read-all', authMiddleware, (req: AuthRequest, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE user_id = ?').run(req.userId!);
  res.json({ ok: true });
});

app.post('/api/messages/send', authMiddleware, (req: AuthRequest, res) => {
  const recipientName = String(req.body?.recipient || '').trim();
  const subject = String(req.body?.subject || '').trim() || 'Direkt-Funkspruch';
  const body = String(req.body?.body || '').trim();

  if (!recipientName || !body) {
    res.status(400).json({ error: 'Empfänger und Nachrichtentext sind erforderlich.' });
    return;
  }
  if (body.length > 1000) {
    res.status(400).json({ error: 'Nachricht darf maximal 1.000 Zeichen lang sein.' });
    return;
  }

  const target = db
    .prepare('SELECT id, username, is_ai FROM users WHERE LOWER(username) = LOWER(?)')
    .get(recipientName) as { id: number; username: string; is_ai: number } | undefined;

  if (!target || target.is_ai === 1) {
    res.status(404).json({ error: 'Kommandant nicht gefunden (KI-Stützpunkte empfangen keine Funksprüche).' });
    return;
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: 'Du kannst dir selbst keinen Funkspruch senden.' });
    return;
  }

  sendMessage(
    target.id,
    'diplomacy',
    `Funkspruch von ${req.username}: ${subject.slice(0, 60)}`,
    body,
    { from: req.username, fromUserId: req.userId }
  );

  res.json({ ok: true });
});

// ================= REAL-TIME SSE, CHAT & ALLIANCES =================

app.get('/api/events', (req, res) => {
  const token = String(req.query.token || '').trim();
  const row = db
    .prepare('SELECT user_id FROM sessions WHERE token = ?')
    .get(token) as { user_id: number } | undefined;

  if (!row) {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const cleanup = registerSseClient(row.user_id, res);
  req.on('close', cleanup);
});

app.get('/api/chat', authMiddleware, (req: AuthRequest, res) => {
  const channel = req.query.channel === 'alliance' ? 'alliance' : 'global';
  if (channel === 'alliance') {
    const user = db
      .prepare('SELECT alliance_id FROM users WHERE id = ?')
      .get(req.userId!) as { alliance_id: number | null } | undefined;
    if (!user?.alliance_id) {
      res.json({ messages: [] });
      return;
    }
    const rows = db
      .prepare(
        `SELECT * FROM chat_messages
         WHERE channel = 'alliance' AND alliance_id = ?
         ORDER BY created_at DESC LIMIT 60`
      )
      .all(user.alliance_id) as Array<{
      id: number;
      channel: 'global' | 'alliance';
      alliance_id: number | null;
      user_id: number;
      username: string;
      alliance_tag: string | null;
      body: string;
      created_at: number;
    }>;
    const messages: ChatMessage[] = rows.reverse().map((r) => ({
      id: r.id,
      channel: r.channel,
      allianceId: r.alliance_id,
      userId: r.user_id,
      username: r.username,
      allianceTag: r.alliance_tag,
      body: r.body,
      createdAt: r.created_at,
    }));
    res.json({ messages });
    return;
  }

  const rows = db
    .prepare(
      `SELECT * FROM chat_messages
       WHERE channel = 'global'
       ORDER BY created_at DESC LIMIT 60`
    )
    .all() as Array<{
    id: number;
    channel: 'global' | 'alliance';
    alliance_id: number | null;
    user_id: number;
    username: string;
    alliance_tag: string | null;
    body: string;
    created_at: number;
  }>;
  const messages: ChatMessage[] = rows.reverse().map((r) => ({
    id: r.id,
    channel: r.channel,
    allianceId: r.alliance_id,
    userId: r.user_id,
    username: r.username,
    allianceTag: r.alliance_tag,
    body: r.body,
    createdAt: r.created_at,
  }));
  res.json({ messages });
});

app.post('/api/chat', authMiddleware, (req: AuthRequest, res) => {
  const channel = req.body?.channel === 'alliance' ? 'alliance' : 'global';
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 400) {
    res.status(400).json({ error: 'Funknachricht muss 1–400 Zeichen lang sein.' });
    return;
  }

  const user = db
    .prepare(
      `SELECT u.id, u.username, u.alliance_id, a.tag as alliance_tag
       FROM users u LEFT JOIN alliances a ON a.id = u.alliance_id
       WHERE u.id = ?`
    )
    .get(req.userId!) as {
    id: number;
    username: string;
    alliance_id: number | null;
    alliance_tag: string | null;
  };

  if (channel === 'alliance' && !user.alliance_id) {
    res.status(400).json({ error: 'Du bist in keiner Allianz.' });
    return;
  }

  const now = Date.now();
  const allianceId = channel === 'alliance' ? user.alliance_id : null;
  const info = db
    .prepare(
      `INSERT INTO chat_messages (channel, alliance_id, user_id, username, alliance_tag, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(channel, allianceId, user.id, user.username, user.alliance_tag, body, now);

  const msg: ChatMessage = {
    id: Number(info.lastInsertRowid),
    channel,
    allianceId,
    userId: user.id,
    username: user.username,
    allianceTag: user.alliance_tag,
    body,
    createdAt: now,
  };

  broadcastChatMessage(msg);
  res.json({ ok: true, message: msg });
});

app.get('/api/alliances', authMiddleware, (req: AuthRequest, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.tag, a.name, a.description, a.leader_id,
              COUNT(u.id) as member_count,
              COALESCE(SUM(u.total_points), 0) as total_points
       FROM alliances a
       LEFT JOIN users u ON u.alliance_id = a.id
       GROUP BY a.id
       ORDER BY total_points DESC, a.id ASC`
    )
    .all() as Array<{
    id: number;
    tag: string;
    name: string;
    description: string;
    leader_id: number;
    member_count: number;
    total_points: number;
  }>;

  const user = db
    .prepare('SELECT alliance_id FROM users WHERE id = ?')
    .get(req.userId!) as { alliance_id: number | null } | undefined;

  const alliances: AllianceInfo[] = rows.map((r) => {
    const entry: AllianceInfo = {
      id: r.id,
      tag: r.tag,
      name: r.name,
      description: r.description,
      leaderId: r.leader_id,
      memberCount: r.member_count,
      totalPoints: r.total_points,
    };
    if (user?.alliance_id === r.id) {
      const mRows = db
        .prepare('SELECT id, username, total_points FROM users WHERE alliance_id = ? ORDER BY total_points DESC')
        .all(r.id) as Array<{ id: number; username: string; total_points: number }>;
      entry.members = mRows.map<AllianceMember>((m) => ({
        userId: m.id,
        username: m.username,
        points: m.total_points,
        isLeader: m.id === r.leader_id,
        isOnline: isUserOnline(m.id),
      }));
    }
    return entry;
  });

  res.json({ alliances, myAllianceId: user?.alliance_id ?? null });
});

app.post('/api/alliances', authMiddleware, (req: AuthRequest, res) => {
  const tag = String(req.body?.tag || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim().slice(0, 240);

  if (tag.length < 2 || tag.length > 5) {
    res.status(400).json({ error: 'Allianz-Kürzel (Tag) muss 2–5 Zeichen lang sein (A-Z, 0-9).' });
    return;
  }
  if (name.length < 3 || name.length > 28) {
    res.status(400).json({ error: 'Allianzname muss 3–28 Zeichen lang sein.' });
    return;
  }

  const current = db
    .prepare('SELECT alliance_id FROM users WHERE id = ?')
    .get(req.userId!) as { alliance_id: number | null };
  if (current.alliance_id) {
    res.status(400).json({ error: 'Verlasse zuerst deine aktuelle Allianz.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM alliances WHERE LOWER(tag) = LOWER(?) OR LOWER(name) = LOWER(?)')
    .get(tag, name);
  if (dup) {
    res.status(409).json({ error: 'Allianz-Kürzel oder Name bereits vergeben.' });
    return;
  }

  const info = db
    .prepare(
      'INSERT INTO alliances (tag, name, description, leader_id, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(tag, name, description, req.userId!, Date.now());
  const allianceId = Number(info.lastInsertRowid);
  db.prepare('UPDATE users SET alliance_id = ? WHERE id = ?').run(allianceId, req.userId!);

  res.json({ ok: true, allianceId });
});

app.post('/api/alliances/:id/join', authMiddleware, (req: AuthRequest, res) => {
  const allianceId = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM alliances WHERE id = ?').get(allianceId);
  if (!exists) {
    res.status(404).json({ error: 'Allianz nicht gefunden.' });
    return;
  }
  db.prepare('UPDATE users SET alliance_id = ? WHERE id = ?').run(allianceId, req.userId!);
  res.json({ ok: true });
});

app.post('/api/alliances/leave', authMiddleware, (req: AuthRequest, res) => {
  const user = db
    .prepare('SELECT alliance_id FROM users WHERE id = ?')
    .get(req.userId!) as { alliance_id: number | null };
  if (!user.alliance_id) {
    res.status(400).json({ error: 'Du bist in keiner Allianz.' });
    return;
  }
  const oldId = user.alliance_id;
  db.prepare('UPDATE users SET alliance_id = NULL WHERE id = ?').run(req.userId!);

  const remaining = (
    db.prepare('SELECT COUNT(*) as c FROM users WHERE alliance_id = ?').get(oldId) as { c: number }
  ).c;
  if (remaining === 0) {
    db.prepare('DELETE FROM alliances WHERE id = ?').run(oldId);
  }
  res.json({ ok: true });
});

// ================= PLAYERS, PACTS & TRADE MARKET =================

const RESOURCE_NAMES: Record<ResourceType, string> = {
  steel: 'Stahl',
  munition: 'Munition',
  fuel: 'Treibstoff',
};

app.get('/api/players', authMiddleware, (req: AuthRequest, res) => {
  const me = req.userId!;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.faction, u.total_points, u.last_seen_at,
              a.tag as alliance_tag,
              (SELECT COUNT(*) FROM bases b WHERE b.user_id = u.id) as bases_count
       FROM users u
       LEFT JOIN alliances a ON a.id = u.alliance_id
       WHERE u.is_ai = 0
       ORDER BY u.total_points DESC, u.id ASC`
    )
    .all() as Array<{
    id: number;
    username: string;
    faction: FactionId;
    total_points: number;
    last_seen_at: number;
    alliance_tag: string | null;
    bases_count: number;
  }>;

  const pacts = db
    .prepare(
      `SELECT id, requester_id, target_id, pact_type, status
       FROM diplomatic_pacts
       WHERE requester_id = ? OR target_id = ?`
    )
    .all(me, me) as Array<{
    id: number;
    requester_id: number;
    target_id: number;
    pact_type: PactType;
    status: 'pending' | 'active';
  }>;

  const pactByOther = new Map<
    number,
    { status: 'pending_out' | 'pending_in' | 'active'; pactType: PactType; pactId: number }
  >();
  for (const p of pacts) {
    const other = p.requester_id === me ? p.target_id : p.requester_id;
    pactByOther.set(other, {
      status:
        p.status === 'active'
          ? 'active'
          : p.requester_id === me
            ? 'pending_out'
            : 'pending_in',
      pactType: p.pact_type,
      pactId: p.id,
    });
  }

  const players: PlayerListItem[] = rows
    .map((r) => {
      const pInfo = pactByOther.get(r.id);
      return {
        userId: r.id,
        username: r.username,
        faction: r.faction || 'mitteleuropa',
        allianceTag: r.alliance_tag,
        points: r.total_points,
        basesCount: r.bases_count,
        isOnline: isUserOnline(r.id),
        lastSeenAt: r.last_seen_at,
        pactStatus: pInfo?.status ?? ('none' as const),
        pactType: pInfo?.pactType,
        pactId: pInfo?.pactId,
      };
    })
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || b.points - a.points);

  res.json({ players });
});

app.get('/api/pacts', authMiddleware, (req: AuthRequest, res) => {
  const me = req.userId!;
  const rows = db
    .prepare(
      `SELECT p.id, p.requester_id, p.target_id, p.pact_type, p.status, p.created_at,
              u1.username as requester_name, u2.username as target_name
       FROM diplomatic_pacts p
       JOIN users u1 ON u1.id = p.requester_id
       JOIN users u2 ON u2.id = p.target_id
       WHERE p.requester_id = ? OR p.target_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(me, me) as Array<{
    id: number;
    requester_id: number;
    target_id: number;
    pact_type: PactType;
    status: 'pending' | 'active';
    created_at: number;
    requester_name: string;
    target_name: string;
  }>;

  const pacts: DiplomaticPact[] = rows.map((r) => ({
    id: r.id,
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    targetId: r.target_id,
    targetName: r.target_name,
    pactType: r.pact_type,
    status: r.status,
    createdAt: r.created_at,
  }));

  res.json({ pacts });
});

app.post('/api/pacts', authMiddleware, (req: AuthRequest, res) => {
  const me = req.userId!;
  const targetUserId = Number(req.body?.targetUserId);
  const pactType: PactType =
    req.body?.pactType === 'military_alliance' ? 'military_alliance' : 'nap';

  if (!targetUserId || targetUserId === me) {
    res.status(400).json({ error: 'Ungültiger Vertragspartner.' });
    return;
  }

  const target = db
    .prepare('SELECT id, username, is_ai FROM users WHERE id = ?')
    .get(targetUserId) as { id: number; username: string; is_ai: number } | undefined;
  if (!target || target.is_ai === 1) {
    res.status(404).json({ error: 'Spieler nicht gefunden.' });
    return;
  }

  const existing = db
    .prepare(
      `SELECT id FROM diplomatic_pacts
       WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)`
    )
    .get(me, targetUserId, targetUserId, me);
  if (existing) {
    res.status(409).json({ error: 'Es besteht bereits ein Vertrag oder eine offene Anfrage mit diesem Spieler.' });
    return;
  }

  const now = Date.now();
  db.prepare(
    `INSERT INTO diplomatic_pacts (requester_id, target_id, pact_type, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(me, targetUserId, pactType, now);

  const label = pactType === 'military_alliance' ? 'Militärbündnis' : 'Nichtangriffspakt (NAP)';
  sendMessage(
    targetUserId,
    'diplomacy',
    `Vertragsangebot: ${label} von ${req.username}`,
    `${req.username} bietet dir ein ${label} an. Öffne „Spieler & Handel“, um den Vertrag anzunehmen oder abzulehnen.`,
    null,
    now
  );

  res.json({ ok: true });
});

app.post('/api/pacts/:id/accept', authMiddleware, (req: AuthRequest, res) => {
  const me = req.userId!;
  const pactId = Number(req.params.id);
  const pact = db
    .prepare('SELECT * FROM diplomatic_pacts WHERE id = ? AND target_id = ? AND status = ?')
    .get(pactId, me, 'pending') as
    | { id: number; requester_id: number; pact_type: PactType }
    | undefined;

  if (!pact) {
    res.status(404).json({ error: 'Offenes Vertragsangebot nicht gefunden.' });
    return;
  }

  db.prepare("UPDATE diplomatic_pacts SET status = 'active' WHERE id = ?").run(pactId);
  const label = pact.pact_type === 'military_alliance' ? 'Militärbündnis' : 'Nichtangriffspakt (NAP)';
  sendMessage(
    pact.requester_id,
    'diplomacy',
    `${label} unterzeichnet mit ${req.username}`,
    `${req.username} hat dein ${label} angenommen! Gegenseitige Angriffe sind nun gesperrt.`,
    null,
    Date.now()
  );

  res.json({ ok: true });
});

app.delete('/api/pacts/:id', authMiddleware, (req: AuthRequest, res) => {
  const me = req.userId!;
  const pactId = Number(req.params.id);
  const pact = db
    .prepare('SELECT * FROM diplomatic_pacts WHERE id = ? AND (requester_id = ? OR target_id = ?)')
    .get(pactId, me, me) as
    | { id: number; requester_id: number; target_id: number; pact_type: PactType; status: string }
    | undefined;

  if (!pact) {
    res.status(404).json({ error: 'Vertrag nicht gefunden.' });
    return;
  }

  db.prepare('DELETE FROM diplomatic_pacts WHERE id = ?').run(pactId);
  const otherId = pact.requester_id === me ? pact.target_id : pact.requester_id;
  const label = pact.pact_type === 'military_alliance' ? 'Militärbündnis' : 'Nichtangriffspakt';
  sendMessage(
    otherId,
    'diplomacy',
    `${label} beendet (${req.username})`,
    `${req.username} hat das bestehende ${label} bzw. das Vertragsangebot aufgehoben.`,
    null,
    Date.now()
  );

  res.json({ ok: true });
});

app.get('/api/trades', authMiddleware, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.seller_user_id, t.seller_base_id, t.offer_resource, t.offer_amount,
              t.want_resource, t.want_amount, t.created_at,
              u.username as seller_name, a.tag as seller_alliance_tag
       FROM trade_offers t
       JOIN users u ON u.id = t.seller_user_id
       LEFT JOIN alliances a ON a.id = u.alliance_id
       WHERE t.status = 'open'
       ORDER BY t.created_at DESC LIMIT 50`
    )
    .all() as Array<{
    id: number;
    seller_user_id: number;
    seller_base_id: number;
    offer_resource: ResourceType;
    offer_amount: number;
    want_resource: ResourceType;
    want_amount: number;
    created_at: number;
    seller_name: string;
    seller_alliance_tag: string | null;
  }>;

  const offers: TradeOffer[] = rows.map((r) => ({
    id: r.id,
    sellerUserId: r.seller_user_id,
    sellerName: r.seller_name,
    sellerAllianceTag: r.seller_alliance_tag,
    sellerBaseId: r.seller_base_id,
    offerResource: r.offer_resource,
    offerAmount: r.offer_amount,
    wantResource: r.want_resource,
    wantAmount: r.want_amount,
    createdAt: r.created_at,
  }));

  res.json({ offers });
});

app.post('/api/trades', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const baseId = Number(req.body?.baseId);
  const offerResource = String(req.body?.offerResource || '') as ResourceType;
  const wantResource = String(req.body?.wantResource || '') as ResourceType;
  const offerAmount = Math.floor(Number(req.body?.offerAmount || 0));
  const wantAmount = Math.floor(Number(req.body?.wantAmount || 0));

  if (!['steel', 'munition', 'fuel'].includes(offerResource) || !['steel', 'munition', 'fuel'].includes(wantResource)) {
    res.status(400).json({ error: 'Ungültiger Rohstofftyp.' });
    return;
  }
  if (offerResource === wantResource) {
    res.status(400).json({ error: 'Angebotener und gesuchter Rohstoff müssen unterschiedlich sein.' });
    return;
  }
  if (offerAmount < 100 || wantAmount < 100 || offerAmount > 500000 || wantAmount > 500000) {
    res.status(400).json({ error: 'Handelsmengen müssen zwischen 100 und 500.000 liegen.' });
    return;
  }

  const base = syncBase(baseId, now);
  if (!base || base.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }
  if (base.resources[offerResource] < offerAmount) {
    res.status(400).json({ error: `Nicht genügend ${RESOURCE_NAMES[offerResource]} im Stützpunkt.` });
    return;
  }

  // Reserve offered resource in escrow
  db.prepare(`UPDATE bases SET ${offerResource} = ${offerResource} - ? WHERE id = ?`).run(
    offerAmount,
    baseId
  );

  db.prepare(
    `INSERT INTO trade_offers (seller_user_id, seller_base_id, offer_resource, offer_amount, want_resource, want_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(req.userId!, baseId, offerResource, offerAmount, wantResource, wantAmount, now);

  res.json({ ok: true });
});

app.post('/api/trades/:id/accept', authMiddleware, (req: AuthRequest, res) => {
  const now = Date.now();
  const offerId = Number(req.params.id);
  const buyerBaseId = Number(req.body?.baseId);

  const offer = db
    .prepare("SELECT * FROM trade_offers WHERE id = ? AND status = 'open'")
    .get(offerId) as
    | {
        id: number;
        seller_user_id: number;
        seller_base_id: number;
        offer_resource: ResourceType;
        offer_amount: number;
        want_resource: ResourceType;
        want_amount: number;
      }
    | undefined;

  if (!offer) {
    res.status(404).json({ error: 'Handelsangebot nicht mehr verfügbar.' });
    return;
  }
  if (offer.seller_user_id === req.userId) {
    res.status(400).json({ error: 'Du kannst dein eigenes Angebot nicht annehmen.' });
    return;
  }

  const buyerBase = syncBase(buyerBaseId, now);
  if (!buyerBase || buyerBase.userId !== req.userId) {
    res.status(404).json({ error: 'Stützpunkt nicht gefunden.' });
    return;
  }
  if (buyerBase.resources[offer.want_resource] < offer.want_amount) {
    res.status(400).json({
      error: `Nicht genügend ${RESOURCE_NAMES[offer.want_resource]} für diesen Handel.`,
    });
    return;
  }

  // Atomic resource swap
  db.prepare(
    `UPDATE bases SET ${offer.want_resource} = ${offer.want_resource} - ?, ${offer.offer_resource} = ${offer.offer_resource} + ? WHERE id = ?`
  ).run(offer.want_amount, offer.offer_amount, buyerBaseId);

  db.prepare(
    `UPDATE bases SET ${offer.want_resource} = ${offer.want_resource} + ? WHERE id = ?`
  ).run(offer.want_amount, offer.seller_base_id);

  db.prepare("UPDATE trade_offers SET status = 'completed' WHERE id = ?").run(offerId);

  sendMessage(
    offer.seller_user_id,
    'transport',
    `Handel abgeschlossen mit ${req.username}`,
    `${req.username} hat dein Angebot angenommen: Du erhältst ${offer.want_amount.toLocaleString('de-DE')} ${RESOURCE_NAMES[offer.want_resource]} für ${offer.offer_amount.toLocaleString('de-DE')} ${RESOURCE_NAMES[offer.offer_resource]}.`,
    null,
    now
  );

  res.json({ ok: true });
});

app.delete('/api/trades/:id', authMiddleware, (req: AuthRequest, res) => {
  const offerId = Number(req.params.id);
  const offer = db
    .prepare("SELECT * FROM trade_offers WHERE id = ? AND seller_user_id = ? AND status = 'open'")
    .get(offerId, req.userId!) as
    | { id: number; seller_base_id: number; offer_resource: ResourceType; offer_amount: number }
    | undefined;

  if (!offer) {
    res.status(404).json({ error: 'Offenes eigenes Handelsangebot nicht gefunden.' });
    return;
  }

  db.prepare("UPDATE trade_offers SET status = 'cancelled' WHERE id = ?").run(offerId);
  db.prepare(
    `UPDATE bases SET ${offer.offer_resource} = ${offer.offer_resource} + ? WHERE id = ?`
  ).run(offer.offer_amount, offer.seller_base_id);

  res.json({ ok: true });
});

// ================= HIGHSCORE =================

app.get('/api/highscore', authMiddleware, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.is_ai, u.building_points, u.research_points, u.military_points, u.total_points,
              a.tag as alliance_tag,
              (SELECT COUNT(*) FROM bases b WHERE b.user_id = u.id) as bases_count
       FROM users u
       LEFT JOIN alliances a ON a.id = u.alliance_id
       ORDER BY u.total_points DESC, u.id ASC`
    )
    .all() as Array<{
    id: number;
    username: string;
    is_ai: number;
    building_points: number;
    research_points: number;
    military_points: number;
    total_points: number;
    alliance_tag: string | null;
    bases_count: number;
  }>;

  const entries: HighscoreEntry[] = rows.map((r, idx) => ({
    rank: idx + 1,
    userId: r.id,
    username: r.username,
    allianceTag: r.alliance_tag,
    isOnline: r.is_ai === 0 && isUserOnline(r.id),
    isAi: r.is_ai === 1,
    basesCount: r.bases_count,
    buildingPoints: r.building_points,
    researchPoints: r.research_points,
    militaryPoints: r.military_points,
    totalPoints: r.total_points,
  }));

  res.json({ entries });
});

// Serve built frontend if present
const clientDist = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Background ticker every 3 seconds to resolve missions cleanly even between client polls
setInterval(() => {
  try {
    processDueMissions(Date.now());
  } catch (err) {
    console.error('Mission tick error:', err);
  }
}, 3000);

app.listen(PORT, () => {
  console.log(`FRONTKOMMANDO 1942 Server aktiv auf http://localhost:${PORT}`);
});
