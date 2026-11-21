export type FactionId = 'mitteleuropa' | 'westallianz' | 'ostfront' | 'nordpakt';

export interface FactionDef {
  id: FactionId;
  name: string;
  shortName: string;
  doctrine: string;
  description: string;
  color: string;       // Hex fill/border accent
  bgClass: string;
  textClass: string;
  bonuses: {
    steelProd: number;     // e.g. 0.2 = +20%
    munitionProd: number;
    fuelProd: number;
    buildSpeed: number;    // e.g. 0.1 = 10% faster
    attack: number;
    armor: number;
    defense: number;
    airAttack: number;
    speed: number;
    cargo: number;
  };
  bonusSummary: string[];
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  mitteleuropa: {
    id: 'mitteleuropa',
    name: 'Mitteleuropa-Kommando',
    shortName: 'Mitteleuropa',
    doctrine: 'Bewegungskrieg-Doktrin',
    description: 'Hochmobile Panzerverbände, schnelle Stützpunkt-Ausbauten und schlagkräftige Durchbruchskräfte.',
    color: '#60a5fa',
    bgClass: 'bg-blue-500/20 border-blue-400/50',
    textClass: 'text-blue-300',
    bonuses: {
      steelProd: 0.05,
      munitionProd: 0.05,
      fuelProd: 0,
      buildSpeed: 0.12,
      attack: 0.15,
      armor: 0.05,
      defense: 0,
      airAttack: 0.05,
      speed: 0.1,
      cargo: 0,
    },
    bonusSummary: ['+15% Angriffskraft (Heer)', '+12% schnellere Bauzeiten', '+10% Marschgeschwindigkeit'],
  },
  westallianz: {
    id: 'westallianz',
    name: 'Westallianz-Oberkommando',
    shortName: 'Westallianz',
    doctrine: 'Industrie & Lufthoheit',
    description: 'Überlegene Kriegsindustrie, reiche Treibstoff-Logistik und dominante Luftwaffenverbände.',
    color: '#4ade80',
    bgClass: 'bg-emerald-500/20 border-emerald-400/50',
    textClass: 'text-emerald-300',
    bonuses: {
      steelProd: 0,
      munitionProd: 0.15,
      fuelProd: 0.15,
      buildSpeed: 0.05,
      attack: 0,
      armor: 0,
      defense: 0.05,
      airAttack: 0.2,
      speed: 0.05,
      cargo: 0.1,
    },
    bonusSummary: ['+15% Munitions- & Treibstoffproduktion', '+20% Luftwaffen-Feuerkraft', '+10% Ladekapazität'],
  },
  ostfront: {
    id: 'ostfront',
    name: 'Ostfront-Gardekommando',
    shortName: 'Ostfront',
    doctrine: 'Stahl & Tiefe Verteidigung',
    description: 'Unerschöpfliche Stahlwerke und schwer gepanzerte Großverbände für zähe Abnutzungsschlachten.',
    color: '#f87171',
    bgClass: 'bg-red-500/20 border-red-400/50',
    textClass: 'text-red-300',
    bonuses: {
      steelProd: 0.2,
      munitionProd: 0.05,
      fuelProd: 0,
      buildSpeed: 0.05,
      attack: 0.05,
      armor: 0.15,
      defense: 0.1,
      airAttack: 0,
      speed: 0,
      cargo: 0,
    },
    bonusSummary: ['+20% Stahlproduktion', '+15% Panzerung & Struktur', '+10% Verteidigungsstärke'],
  },
  nordpakt: {
    id: 'nordpakt',
    name: 'Süd- & Nordpakt',
    shortName: 'Nordpakt',
    doctrine: 'Festung & Nachschub',
    description: 'Uneinnehmbare Bunkerlinien, schnelle Konvois und flexible Küsten- & Gebirgsoperationen.',
    color: '#fbbf24',
    bgClass: 'bg-amber-500/20 border-amber-400/50',
    textClass: 'text-amber-300',
    bonuses: {
      steelProd: 0.05,
      munitionProd: 0.05,
      fuelProd: 0.1,
      buildSpeed: 0,
      attack: 0,
      armor: 0.05,
      defense: 0.2,
      airAttack: 0,
      speed: 0.15,
      cargo: 0.2,
    },
    bonusSummary: ['+20% Verteidigungsanlagen', '+20% Konvoi-Ladekapazität', '+15% Marschgeschwindigkeit'],
  },
};

export const FACTION_ORDER: FactionId[] = [
  'mitteleuropa',
  'westallianz',
  'ostfront',
  'nordpakt',
];

export interface ProvinceBonus {
  type: 'steel' | 'munition' | 'fuel' | 'defense';
  percent: number;
  label: string;
}

export interface ProvinceDef {
  id: string;
  name: string;
  theater: string;
  sector: number;
  position: number;
  cx: number;
  cy: number;
  path: string;
  neighbors: string[];
  bonus: ProvinceBonus;
}

// 24 stylized European strategic provinces on a 1000x620 SVG tactical map
export const PROVINCES: ProvinceDef[] = [
  // SECTOR 1: Westfront
  {
    id: 'britannien',
    name: 'Britannien',
    theater: 'Westfront',
    sector: 1,
    position: 1,
    cx: 215,
    cy: 215,
    path: 'M 170 155 L 235 140 L 258 195 L 265 255 L 185 270 L 160 225 Z',
    neighbors: ['normandie', 'benelux', 'norwegen'],
    bonus: { type: 'munition', percent: 25, label: '+25% Munition' },
  },
  {
    id: 'normandie',
    name: 'Normandie',
    theater: 'Westfront',
    sector: 1,
    position: 3,
    cx: 245,
    cy: 335,
    path: 'M 175 295 L 295 288 L 305 365 L 220 385 L 172 348 Z',
    neighbors: ['britannien', 'benelux', 'frankreich', 'iberien'],
    bonus: { type: 'fuel', percent: 15, label: '+15% Treibstoff' },
  },
  {
    id: 'benelux',
    name: 'Benelux',
    theater: 'Westfront',
    sector: 1,
    position: 5,
    cx: 332,
    cy: 280,
    path: 'M 295 255 L 368 248 L 372 312 L 298 310 Z',
    neighbors: ['britannien', 'normandie', 'rheinland', 'daenemark'],
    bonus: { type: 'munition', percent: 20, label: '+20% Munition' },
  },
  {
    id: 'frankreich',
    name: 'Zentralfrankreich',
    theater: 'Westfront',
    sector: 1,
    position: 7,
    cx: 292,
    cy: 415,
    path: 'M 220 385 L 352 360 L 368 448 L 255 468 L 210 432 Z',
    neighbors: ['normandie', 'rheinland', 'alpen', 'iberien', 'norditalien'],
    bonus: { type: 'steel', percent: 15, label: '+15% Stahl' },
  },
  {
    id: 'iberien',
    name: 'Iberien',
    theater: 'Westfront',
    sector: 1,
    position: 12,
    cx: 155,
    cy: 470,
    path: 'M 78 415 L 212 415 L 222 505 L 122 535 L 72 485 Z',
    neighbors: ['normandie', 'frankreich', 'nordafrika'],
    bonus: { type: 'steel', percent: 20, label: '+20% Stahl' },
  },

  // SECTOR 2: Mitteleuropa
  {
    id: 'rheinland',
    name: 'Rheinland / Ruhr',
    theater: 'Mitteleuropa',
    sector: 2,
    position: 2,
    cx: 415,
    cy: 300,
    path: 'M 368 248 L 455 245 L 460 352 L 352 360 L 372 312 Z',
    neighbors: ['benelux', 'frankreich', 'daenemark', 'brandenburg', 'alpen'],
    bonus: { type: 'steel', percent: 30, label: '+30% Stahl' },
  },
  {
    id: 'brandenburg',
    name: 'Brandenburg',
    theater: 'Mitteleuropa',
    sector: 2,
    position: 4,
    cx: 505,
    cy: 270,
    path: 'M 455 225 L 558 222 L 560 322 L 460 325 Z',
    neighbors: ['daenemark', 'rheinland', 'boehmen', 'polen', 'ostpreussen'],
    bonus: { type: 'munition', percent: 25, label: '+25% Munition' },
  },
  {
    id: 'alpen',
    name: 'Alpenfestung',
    theater: 'Mitteleuropa',
    sector: 2,
    position: 6,
    cx: 432,
    cy: 392,
    path: 'M 352 360 L 495 352 L 502 425 L 368 432 Z',
    neighbors: ['frankreich', 'rheinland', 'boehmen', 'norditalien', 'karpaten'],
    bonus: { type: 'defense', percent: 25, label: '+25% Verteidigung' },
  },
  {
    id: 'boehmen',
    name: 'Böhmen & Mähren',
    theater: 'Mitteleuropa',
    sector: 2,
    position: 9,
    cx: 535,
    cy: 358,
    path: 'M 460 325 L 598 322 L 596 392 L 495 392 Z',
    neighbors: ['rheinland', 'brandenburg', 'polen', 'karpaten', 'alpen'],
    bonus: { type: 'steel', percent: 25, label: '+25% Stahl' },
  },
  {
    id: 'polen',
    name: 'Polen',
    theater: 'Mitteleuropa',
    sector: 2,
    position: 14,
    cx: 625,
    cy: 282,
    path: 'M 558 235 L 688 232 L 692 332 L 598 335 L 560 322 Z',
    neighbors: ['brandenburg', 'ostpreussen', 'belarus', 'ukraine', 'karpaten', 'boehmen'],
    bonus: { type: 'munition', percent: 15, label: '+15% Munition' },
  },

  // SECTOR 3: Ostfront
  {
    id: 'ostpreussen',
    name: 'Ostpreußen / Baltikum',
    theater: 'Ostfront',
    sector: 3,
    position: 2,
    cx: 660,
    cy: 192,
    path: 'M 588 158 L 725 148 L 732 232 L 585 235 Z',
    neighbors: ['brandenburg', 'polen', 'belarus', 'finnland', 'moskau'],
    bonus: { type: 'defense', percent: 15, label: '+15% Verteidigung' },
  },
  {
    id: 'belarus',
    name: 'Belarus',
    theater: 'Ostfront',
    sector: 3,
    position: 5,
    cx: 750,
    cy: 278,
    path: 'M 688 232 L 818 225 L 822 325 L 692 332 Z',
    neighbors: ['ostpreussen', 'polen', 'ukraine', 'moskau'],
    bonus: { type: 'steel', percent: 20, label: '+20% Stahl' },
  },
  {
    id: 'moskau',
    name: 'Moskau-Vorland',
    theater: 'Ostfront',
    sector: 3,
    position: 8,
    cx: 878,
    cy: 225,
    path: 'M 812 142 L 955 135 L 962 308 L 822 315 Z',
    neighbors: ['finnland', 'ostpreussen', 'belarus', 'ukraine', 'kaukasus'],
    bonus: { type: 'munition', percent: 30, label: '+30% Munition' },
  },
  {
    id: 'ukraine',
    name: 'Ukraine',
    theater: 'Ostfront',
    sector: 3,
    position: 11,
    cx: 775,
    cy: 382,
    path: 'M 692 332 L 858 318 L 865 435 L 698 442 Z',
    neighbors: ['polen', 'belarus', 'moskau', 'kaukasus', 'karpaten', 'balkan'],
    bonus: { type: 'steel', percent: 25, label: '+25% Stahl' },
  },
  {
    id: 'kaukasus',
    name: 'Kaukasus-Ölfelder',
    theater: 'Ostfront',
    sector: 3,
    position: 14,
    cx: 912,
    cy: 425,
    path: 'M 858 318 L 968 312 L 972 512 L 868 505 Z',
    neighbors: ['moskau', 'ukraine'],
    bonus: { type: 'fuel', percent: 40, label: '+40% Treibstoff' },
  },

  // SECTOR 4: Nordeuropa
  {
    id: 'norwegen',
    name: 'Norwegen',
    theater: 'Nordeuropa',
    sector: 4,
    position: 2,
    cx: 418,
    cy: 118,
    path: 'M 365 55 L 478 48 L 465 178 L 368 182 Z',
    neighbors: ['britannien', 'daenemark', 'schweden'],
    bonus: { type: 'steel', percent: 25, label: '+25% Stahl' },
  },
  {
    id: 'schweden',
    name: 'Schweden',
    theater: 'Nordeuropa',
    sector: 4,
    position: 6,
    cx: 530,
    cy: 115,
    path: 'M 478 48 L 598 48 L 588 182 L 465 178 Z',
    neighbors: ['norwegen', 'daenemark', 'finnland'],
    bonus: { type: 'steel', percent: 30, label: '+30% Stahl' },
  },
  {
    id: 'finnland',
    name: 'Finnland / Karelien',
    theater: 'Nordeuropa',
    sector: 4,
    position: 10,
    cx: 675,
    cy: 98,
    path: 'M 598 48 L 765 52 L 758 148 L 588 158 Z',
    neighbors: ['schweden', 'ostpreussen', 'moskau'],
    bonus: { type: 'defense', percent: 20, label: '+20% Verteidigung' },
  },
  {
    id: 'daenemark',
    name: 'Dänemark / Nordsee',
    theater: 'Nordeuropa',
    sector: 4,
    position: 13,
    cx: 452,
    cy: 208,
    path: 'M 392 182 L 512 180 L 515 225 L 392 228 Z',
    neighbors: ['norwegen', 'schweden', 'benelux', 'rheinland', 'brandenburg'],
    bonus: { type: 'fuel', percent: 20, label: '+20% Treibstoff' },
  },

  // SECTOR 5: Südeuropa & Mittelmeer
  {
    id: 'norditalien',
    name: 'Norditalien',
    theater: 'Südeuropa',
    sector: 5,
    position: 2,
    cx: 448,
    cy: 472,
    path: 'M 368 432 L 522 425 L 532 505 L 392 508 Z',
    neighbors: ['frankreich', 'alpen', 'karpaten', 'sueditalien', 'balkan'],
    bonus: { type: 'munition', percent: 20, label: '+20% Munition' },
  },
  {
    id: 'sueditalien',
    name: 'Süditalien / Sizilien',
    theater: 'Südeuropa',
    sector: 5,
    position: 5,
    cx: 492,
    cy: 548,
    path: 'M 425 508 L 548 505 L 555 582 L 442 586 Z',
    neighbors: ['norditalien', 'griechenland', 'nordafrika'],
    bonus: { type: 'fuel', percent: 20, label: '+20% Treibstoff' },
  },
  {
    id: 'karpaten',
    name: 'Karpaten / Rumänien',
    theater: 'Südeuropa',
    sector: 5,
    position: 8,
    cx: 605,
    cy: 432,
    path: 'M 502 392 L 695 392 L 698 468 L 522 465 Z',
    neighbors: ['alpen', 'boehmen', 'polen', 'ukraine', 'balkan', 'norditalien'],
    bonus: { type: 'fuel', percent: 35, label: '+35% Treibstoff' },
  },
  {
    id: 'balkan',
    name: 'Balkan',
    theater: 'Südeuropa',
    sector: 5,
    position: 11,
    cx: 625,
    cy: 505,
    path: 'M 532 465 L 718 468 L 715 538 L 548 538 Z',
    neighbors: ['norditalien', 'karpaten', 'ukraine', 'griechenland'],
    bonus: { type: 'defense', percent: 20, label: '+20% Verteidigung' },
  },
  {
    id: 'griechenland',
    name: 'Griechenland / Ägäis',
    theater: 'Südeuropa',
    sector: 5,
    position: 13,
    cx: 650,
    cy: 568,
    path: 'M 568 538 L 725 538 L 720 598 L 580 598 Z',
    neighbors: ['balkan', 'sueditalien', 'nordafrika'],
    bonus: { type: 'defense', percent: 15, label: '+15% Verteidigung' },
  },
  {
    id: 'nordafrika',
    name: 'Nordafrika / Mittelmeer',
    theater: 'Südeuropa',
    sector: 5,
    position: 15,
    cx: 295,
    cy: 572,
    path: 'M 148 548 L 425 548 L 435 604 L 145 604 Z',
    neighbors: ['iberien', 'sueditalien', 'griechenland'],
    bonus: { type: 'fuel', percent: 30, label: '+30% Treibstoff' },
  },
];

export const PROVINCE_BY_ID = new Map(PROVINCES.map((p) => [p.id, p]));
export const PROVINCE_BY_COORDS = new Map(
  PROVINCES.map((p) => [`${p.sector}:${p.position}`, p])
);

export function getProvinceByCoords(sector: number, position: number): ProvinceDef | undefined {
  return PROVINCE_BY_COORDS.get(`${sector}:${position}`);
}
