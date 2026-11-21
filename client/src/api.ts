import type {
  AllianceInfo,
  BuildingId,
  ChatMessage,
  CombatEntityId,
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
} from '@shared/types';
import type { FactionId } from '@shared/worldMap';

const TOKEN_KEY = 'fk1942_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      setStoredToken(null);
    }
    throw new Error(data.error || `Fehler (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (username: string, password: string, faction: FactionId = 'mitteleuropa') =>
    request<{ token: string; username: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, faction }),
    }),

  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  quickstart: (faction: FactionId = 'mitteleuropa') =>
    request<{ token: string; username: string }>('/api/auth/quickstart', {
      method: 'POST',
      body: JSON.stringify({ faction }),
    }),

  getAuthProviders: () =>
    request<{ googleEnabled: boolean; googleClientId: string | null }>('/api/auth/providers'),

  loginWithGoogle: (credential: string, faction: FactionId = 'mitteleuropa') =>
    request<{ token: string; username: string; isNew: boolean }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, faction }),
    }),

  setFaction: (faction: FactionId) =>
    request<{ ok: boolean; faction: FactionId }>('/api/user/faction', {
      method: 'POST',
      body: JSON.stringify({ faction }),
    }),

  getWorld: () =>
    request<{
      provinces: WorldProvinceState[];
      factionCounts: Record<string, number>;
    }>('/api/world'),

  claimTutorial: (baseId: number) =>
    request<{ ok: boolean; nextStep: number; rewardLabel: string }>('/api/tutorial/claim', {
      method: 'POST',
      body: JSON.stringify({ baseId }),
    }),

  dismissTutorial: (dismissed = true) =>
    request<{ ok: boolean }>('/api/tutorial/dismiss', {
      method: 'POST',
      body: JSON.stringify({ dismissed }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getState: (baseId?: number) =>
    request<GameStateResponse>(
      baseId ? `/api/state?baseId=${baseId}` : '/api/state'
    ),

  renameBase: (baseId: number, name: string) =>
    request<{ ok: boolean }>(`/api/bases/${baseId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  startBuild: (baseId: number, buildingId: BuildingId) =>
    request<{ ok: boolean; endsAt: number }>(`/api/bases/${baseId}/build`, {
      method: 'POST',
      body: JSON.stringify({ buildingId }),
    }),

  cancelBuild: (baseId: number) =>
    request<{ ok: boolean }>(`/api/bases/${baseId}/build/cancel`, {
      method: 'POST',
    }),

  startResearch: (baseId: number, researchId: ResearchId) =>
    request<{ ok: boolean; endsAt: number }>(`/api/bases/${baseId}/research`, {
      method: 'POST',
      body: JSON.stringify({ researchId }),
    }),

  produce: (
    baseId: number,
    entityType: 'unit' | 'defense',
    entityId: CombatEntityId,
    count: number
  ) =>
    request<{ ok: boolean }>(`/api/bases/${baseId}/produce`, {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId, count }),
    }),

  getSector: (sector: number) =>
    request<{ sector: number; maxSectors: number; slots: SectorSlot[] }>(
      `/api/sectors/${sector}`
    ),

  launchMission: (payload: {
    originBaseId: number;
    targetSector: number;
    targetPosition: number;
    missionType: MissionType;
    units: Partial<Record<UnitId, number>>;
    cargo: Resources;
  }) =>
    request<{ ok: boolean; missionId: number; arrivesAt: number }>(
      '/api/missions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  recallMission: (missionId: number) =>
    request<{ ok: boolean }>(`/api/missions/${missionId}/recall`, {
      method: 'POST',
    }),

  getMessages: () => request<{ messages: GameMessage[] }>('/api/messages'),

  markMessageRead: (id: number) =>
    request<{ ok: boolean }>(`/api/messages/${id}/read`, { method: 'POST' }),

  markAllMessagesRead: () =>
    request<{ ok: boolean }>('/api/messages/read-all', { method: 'POST' }),

  sendDirectMessage: (recipient: string, subject: string, body: string) =>
    request<{ ok: boolean }>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ recipient, subject, body }),
    }),

  getChat: (channel: 'global' | 'alliance') =>
    request<{ messages: ChatMessage[] }>(`/api/chat?channel=${channel}`),

  sendChat: (channel: 'global' | 'alliance', body: string) =>
    request<{ ok: boolean; message: ChatMessage }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ channel, body }),
    }),

  getAlliances: () =>
    request<{ alliances: AllianceInfo[]; myAllianceId: number | null }>('/api/alliances'),

  createAlliance: (tag: string, name: string, description: string) =>
    request<{ ok: boolean; allianceId: number }>('/api/alliances', {
      method: 'POST',
      body: JSON.stringify({ tag, name, description }),
    }),

  joinAlliance: (id: number) =>
    request<{ ok: boolean }>(`/api/alliances/${id}/join`, { method: 'POST' }),

  leaveAlliance: () =>
    request<{ ok: boolean }>('/api/alliances/leave', { method: 'POST' }),

  getPlayers: () => request<{ players: PlayerListItem[] }>('/api/players'),

  getPacts: () => request<{ pacts: DiplomaticPact[] }>('/api/pacts'),

  proposePact: (targetUserId: number, pactType: PactType) =>
    request<{ ok: boolean }>('/api/pacts', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, pactType }),
    }),

  acceptPact: (pactId: number) =>
    request<{ ok: boolean }>(`/api/pacts/${pactId}/accept`, { method: 'POST' }),

  cancelPact: (pactId: number) =>
    request<{ ok: boolean }>(`/api/pacts/${pactId}`, { method: 'DELETE' }),

  getTrades: () => request<{ offers: TradeOffer[] }>('/api/trades'),

  createTrade: (payload: {
    baseId: number;
    offerResource: ResourceType;
    offerAmount: number;
    wantResource: ResourceType;
    wantAmount: number;
  }) =>
    request<{ ok: boolean }>('/api/trades', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  acceptTrade: (offerId: number, baseId: number) =>
    request<{ ok: boolean }>(`/api/trades/${offerId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ baseId }),
    }),

  cancelTrade: (offerId: number) =>
    request<{ ok: boolean }>(`/api/trades/${offerId}`, { method: 'DELETE' }),

  getHighscore: () => request<{ entries: HighscoreEntry[] }>('/api/highscore'),
};

export function fmtNum(n: number): string {
  return Math.floor(n).toLocaleString('de-DE');
}

export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const MISSION_LABELS: Record<MissionType, string> = {
  spy: 'Aufklären',
  attack: 'Angreifen',
  conquer: 'Provinz erobern',
  transport: 'Transportieren',
  deploy: 'Stationieren',
  colonize: 'Provinz einnehmen',
};
