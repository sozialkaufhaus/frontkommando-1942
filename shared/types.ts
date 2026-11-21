import type { FactionId } from './worldMap';

export type ResourceType = 'steel' | 'munition' | 'fuel';

export interface Resources {
  steel: number;
  munition: number;
  fuel: number;
}

export type BuildingId =
  | 'steel_mill'
  | 'munition_factory'
  | 'refinery'
  | 'power_plant'
  | 'steel_storage'
  | 'fuel_depot'
  | 'hq'
  | 'tank_works'
  | 'airfield'
  | 'research_lab'
  | 'radar_station';

export type ResearchId =
  | 'armor_tech'
  | 'weapons_tech'
  | 'engine_tech'
  | 'radio_intel'
  | 'logistics'
  | 'colonization';

export type UnitId =
  | 'scout_car'
  | 'truck_convoy'
  | 'infantry'
  | 'light_tank'
  | 'heavy_tank'
  | 'artillery'
  | 'fighter'
  | 'bomber';

export type DefenseId =
  | 'mg_nest'
  | 'pak_gun'
  | 'flak_battery'
  | 'heavy_bunker';

export type CombatEntityId = UnitId | DefenseId;

export type MissionType = 'spy' | 'attack' | 'conquer' | 'transport' | 'deploy' | 'colonize';

export interface Prerequisite {
  building?: Partial<Record<BuildingId, number>>;
  research?: Partial<Record<ResearchId, number>>;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  category: 'resources' | 'facility';
  description: string;
  baseCost: Resources;
  costFactor: number;
  baseEnergyUse?: number;
  image: string;
  prereq?: Prerequisite;
}

export interface ResearchDef {
  id: ResearchId;
  name: string;
  description: string;
  effectText: string;
  baseCost: Resources;
  costFactor: number;
  image: string;
  prereq?: Prerequisite;
}

export interface UnitDef {
  id: UnitId;
  name: string;
  category: 'ground' | 'air';
  description: string;
  cost: Resources;
  structure: number; // Panzerung / HP
  shield: number;    // Schutz / Deckung
  attack: number;    // Feuerkraft
  speed: number;
  cargo: number;
  fuelConsumption: number;
  rapidfire?: Partial<Record<CombatEntityId, number>>;
  image: string;
  prereq?: Prerequisite;
}

export interface DefenseDef {
  id: DefenseId;
  name: string;
  description: string;
  cost: Resources;
  structure: number;
  shield: number;
  attack: number;
  rapidfire?: Partial<Record<CombatEntityId, number>>;
  image: string;
  prereq?: Prerequisite;
}

export interface BuildQueueItem {
  id: number;
  baseId: number;
  buildingId: BuildingId;
  targetLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface ResearchQueueItem {
  id: number;
  userId: number;
  baseId: number;
  researchId: ResearchId;
  targetLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface UnitQueueItem {
  id: number;
  baseId: number;
  entityType: 'unit' | 'defense';
  entityId: CombatEntityId;
  count: number;
  unitDurationSec: number;
  startedAt: number;
  nextEndsAt: number;
}

export interface FleetMission {
  id: number;
  userId: number;
  originBaseId: number;
  originName: string;
  originSector: number;
  originPosition: number;
  targetSector: number;
  targetPosition: number;
  targetBaseName: string;
  missionType: MissionType;
  units: Partial<Record<UnitId, number>>;
  cargo: Resources;
  departedAt: number;
  arrivesAt: number;
  returnsAt: number | null;
  status: 'outbound' | 'returning';
}

export interface BaseSummary {
  id: number;
  name: string;
  sector: number;
  position: number;
  isHome: boolean;
}

export interface BaseState {
  id: number;
  userId: number;
  name: string;
  sector: number;
  position: number;
  isHome: boolean;
  resources: Resources;
  storage: Resources;
  productionPerHour: Resources;
  energyProduced: number;
  energyConsumed: number;
  energyEfficiency: number; // 0..1
  buildings: Record<BuildingId, number>;
  units: Record<UnitId, number>;
  defenses: Record<DefenseId, number>;
  buildQueue: BuildQueueItem | null;
  unitQueue: UnitQueueItem[];
  updatedAt: number;
}

export interface TutorialState {
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  stepReadyToClaim: boolean;
  dismissed: boolean;
}

export interface GameStateResponse {
  serverTime: number;
  onlineCount: number;
  tutorial: TutorialState;
  user: {
    id: number;
    username: string;
    commanderTitle: string;
    faction: FactionId;
    points: number;
    unreadMessages: number;
    allianceId: number | null;
    allianceTag: string | null;
    allianceName: string | null;
  };
  bases: BaseSummary[];
  activeBase: BaseState;
  research: Record<ResearchId, number>;
  researchQueue: ResearchQueueItem | null;
  activeMissions: FleetMission[];
  incomingMissions: FleetMission[];
}

export interface WorldProvinceState {
  provinceId: string;
  sector: number;
  position: number;
  baseId: number | null;
  baseName: string | null;
  ownerId: number | null;
  ownerName: string | null;
  ownerFaction: FactionId | null;
  allianceTag: string | null;
  isAi: boolean;
  isOwn: boolean;
  isOnline: boolean;
  aiDifficulty?: string;
  points: number;
  defensePower: number;
}

export interface SectorSlot {
  sector: number;
  position: number;
  baseId: number | null;
  baseName: string | null;
  ownerName: string | null;
  ownerId: number | null;
  allianceTag?: string | null;
  isOnline?: boolean;
  isAi: boolean;
  isOwn: boolean;
  aiDifficulty?: string;
  points?: number;
}

export interface CombatRoundReport {
  round: number;
  attackerShots: number;
  attackerDamage: number;
  defenderAbsorbed: number;
  defenderShots: number;
  defenderDamage: number;
  attackerAbsorbed: number;
  attackerRemaining: Partial<Record<CombatEntityId, number>>;
  defenderRemaining: Partial<Record<CombatEntityId, number>>;
}

export interface CombatReportData {
  attackerName: string;
  defenderName: string;
  targetCoords: string;
  attackerTech: { weapons: number; armor: number };
  defenderTech: { weapons: number; armor: number };
  attackerInitial: Partial<Record<CombatEntityId, number>>;
  defenderInitial: Partial<Record<CombatEntityId, number>>;
  rounds: CombatRoundReport[];
  outcome: 'attacker_win' | 'defender_win' | 'draw';
  loot: Resources;
  attackerLosses: Resources;
  defenderLosses: Resources;
  rebuiltDefenses: Partial<Record<DefenseId, number>>;
}

export interface SpyReportData {
  targetName: string;
  ownerName: string;
  coords: string;
  intelLevel: number;
  resources: Resources;
  units?: Partial<Record<UnitId, number>>;
  defenses?: Partial<Record<DefenseId, number>>;
  buildings?: Partial<Record<BuildingId, number>>;
  research?: Partial<Record<ResearchId, number>>;
}

export interface GameMessage {
  id: number;
  type: 'combat' | 'spy' | 'transport' | 'system' | 'diplomacy';
  title: string;
  body: string;
  data: CombatReportData | SpyReportData | Record<string, unknown> | null;
  isRead: boolean;
  createdAt: number;
}

export interface HighscoreEntry {
  rank: number;
  userId: number;
  username: string;
  allianceTag?: string | null;
  isOnline?: boolean;
  isAi: boolean;
  basesCount: number;
  buildingPoints: number;
  researchPoints: number;
  militaryPoints: number;
  totalPoints: number;
}

export interface ChatMessage {
  id: number;
  channel: 'global' | 'alliance';
  allianceId: number | null;
  userId: number;
  username: string;
  allianceTag: string | null;
  body: string;
  createdAt: number;
}

export interface AllianceMember {
  userId: number;
  username: string;
  points: number;
  isLeader: boolean;
  isOnline: boolean;
}

export interface AllianceInfo {
  id: number;
  tag: string;
  name: string;
  description: string;
  leaderId: number;
  memberCount: number;
  totalPoints: number;
  members?: AllianceMember[];
}

export type PactType = 'nap' | 'military_alliance';

export interface DiplomaticPact {
  id: number;
  requesterId: number;
  requesterName: string;
  targetId: number;
  targetName: string;
  pactType: PactType;
  status: 'pending' | 'active';
  createdAt: number;
}

export interface PlayerListItem {
  userId: number;
  username: string;
  faction: FactionId;
  allianceTag: string | null;
  points: number;
  basesCount: number;
  isOnline: boolean;
  lastSeenAt: number;
  pactStatus: 'none' | 'pending_out' | 'pending_in' | 'active';
  pactType?: PactType;
  pactId?: number;
}

export interface TradeOffer {
  id: number;
  sellerUserId: number;
  sellerName: string;
  sellerAllianceTag: string | null;
  sellerBaseId: number;
  offerResource: ResourceType;
  offerAmount: number;
  wantResource: ResourceType;
  wantAmount: number;
  createdAt: number;
}
