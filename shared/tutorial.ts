import type { Resources, UnitId } from './types';

export interface TutorialStepDef {
  step: number;
  code: string;
  title: string;
  briefing: string;
  objective: string;
  tip: string;
  targetTab: 'buildings' | 'research' | 'units' | 'world';
  rewardResources: Resources;
  rewardUnits?: Partial<Record<UnitId, number>>;
  rewardLabel: string;
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    step: 0,
    code: 'AUFTRAG 01',
    title: 'Kriegswirtschaft hochfahren',
    briefing:
      'Willkommen im Hauptquartier, Kommandant! Bevor wir in die Offensive gehen, muss die Rohstoffversorgung deines Stützpunkts gesichert sein.',
    objective: 'Baue dein Stahlwerk auf mindestens Stufe 4 aus (bei 100% Stromversorgung).',
    tip: 'Öffne „Stützpunkt-Ausbau“ und klicke auf das Stahlwerk. Falls der Strom knapp wird, baue zuerst das Kraftwerk aus.',
    targetTab: 'buildings',
    rewardResources: { steel: 1500, munition: 800, fuel: 400 },
    rewardLabel: '+1.500 Stahl, +800 Munition, +400 Treibstoff',
  },
  {
    step: 1,
    code: 'AUFTRAG 02',
    title: 'Technologischer Vorsprung',
    briefing:
      'Moderne Kriegsführung wird in den Konstruktionsbüros entschieden. Forschung stärkt alle deine Provinzen gleichzeitig.',
    objective: 'Erreiche insgesamt mindestens 3 Forschungsstufen (z. B. Panzerungs-, Waffen- oder Motorentechnik).',
    tip: 'Wechsle in den Tab „Forschung“ und starte eine beliebige Entwicklung im Forschungszentrum.',
    targetTab: 'research',
    rewardResources: { steel: 1200, munition: 1200, fuel: 600 },
    rewardLabel: '+1.200 Stahl, +1.200 Munition, +600 Treibstoff',
  },
  {
    step: 2,
    code: 'AUFTRAG 03',
    title: 'Einsatzverband aufstellen',
    briefing:
      'Unsere Nachbarprovinzen sind befestigt. Rekrutiere im Panzerwerk schlagkräftige Truppen für den ersten Vorstoß.',
    objective: 'Besitze mindestens 12 einsatzbereite Einheiten in deinem aktiven Stützpunkt.',
    tip: 'Öffne „Einheiten“ und baue zusätzliche Infanterie-Trupps, Spähwagen oder Leichte Panzer.',
    targetTab: 'units',
    rewardResources: { steel: 2000, munition: 1000, fuel: 500 },
    rewardUnits: { scout_car: 3 },
    rewardLabel: '+2.000 Stahl, +1.000 Munition, +3 Spähwagen',
  },
  {
    step: 3,
    code: 'AUFTRAG 04',
    title: 'Feindaufklärung an der Front',
    briefing:
      'Greife niemals blind an! Unsere Spähwagen liefern präzise Berichte über gegnerische Rohstoffe, Truppen und Bunker.',
    objective: 'Entsende einen Spähwagen zur Aufklärung auf eine feindliche Provinz auf der Europa-Karte.',
    tip: 'Öffne die „Europa-Karte“, klicke eine KI-Provinz (z. B. Normandie oder Brandenburg) an und drücke „Sofort aufklären“.',
    targetTab: 'world',
    rewardResources: { steel: 1500, munition: 1500, fuel: 1000 },
    rewardLabel: '+1.500 Stahl, +1.500 Munition, +1.000 Treibstoff',
  },
  {
    step: 4,
    code: 'AUFTRAG 05',
    title: 'Feuertaufe — Erster Angriff',
    briefing:
      'Die Aufklärungsdaten liegen vor. Starte deinen ersten Gefechtseinsatz gegen eine leichte KI-Stellung und sichere Beute!',
    objective: 'Starte einen Angriff (oder Eroberungsangriff) und erhalte deinen ersten Kampfbericht.',
    tip: 'Wähle auf der Europa-Karte eine „Leicht“-KI-Provinz, klicke „Angreifen“ und nimm LKW-Konvois für maximale Beute mit.',
    targetTab: 'world',
    rewardResources: { steel: 3500, munition: 2000, fuel: 1500 },
    rewardLabel: '+3.500 Stahl, +2.000 Munition, +1.500 Treibstoff',
  },
  {
    step: 5,
    code: 'AUFTRAG 06',
    title: 'Staatsgebiet erweitern',
    briefing:
      'Ein einzelner Stützpunkt reicht nicht für die Vorherrschaft in Europa. Dehne dein Staatsgebiet auf eine zweite Provinz aus!',
    objective: 'Kontrolliere mindestens 2 Provinzen / Stützpunkte auf der Europa-Karte.',
    tip: 'Klicke auf der Europa-Karte eine graue, freie Provinz (z. B. mit +30% Stahl oder +40% Treibstoff) an und wähle „Provinz einnehmen“.',
    targetTab: 'world',
    rewardResources: { steel: 5000, munition: 3500, fuel: 2500 },
    rewardUnits: { light_tank: 2 },
    rewardLabel: '+5.000 Stahl, +3.500 Munition, +2.500 Treibstoff, +2 Leichte Panzer',
  },
];
