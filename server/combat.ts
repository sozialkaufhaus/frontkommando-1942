import {
  DEFENSES,
  UNITS,
  getCombatEntityStats,
} from '../shared/gameData';
import type {
  CombatEntityId,
  CombatReportData,
  CombatRoundReport,
  DefenseId,
  Resources,
  UnitId,
} from '../shared/types';

interface CombatEntityInstance {
  type: CombatEntityId;
  maxHull: number;
  hull: number;
  maxShield: number;
  shield: number;
  attack: number;
  destroyed: boolean;
}

function expandArmy(
  counts: Partial<Record<CombatEntityId, number>>,
  weaponsTech: number,
  armorTech: number
): CombatEntityInstance[] {
  const list: CombatEntityInstance[] = [];
  const atkMult = 1 + weaponsTech * 0.1;
  const armMult = 1 + armorTech * 0.1;
  const hasCarrier = (counts.carrier || 0) > 0;

  for (const [id, rawCount] of Object.entries(counts) as [CombatEntityId, number][]) {
    const count = Math.floor(rawCount || 0);
    if (count <= 0) continue;
    const stats = getCombatEntityStats(id);
    const maxHull = Math.round(stats.structure * armMult);
    const maxShield = Math.round(stats.shield * armMult);
    const isAir = id in UNITS && UNITS[id as UnitId].category === 'air';
    const carrierBonus = hasCarrier && isAir ? 1.15 : 1;
    const attack = Math.round(stats.attack * atkMult * carrierBonus);
    for (let i = 0; i < count; i++) {
      list.push({
        type: id,
        maxHull,
        hull: maxHull,
        maxShield,
        shield: maxShield,
        attack,
        destroyed: false,
      });
    }
  }
  return list;
}

function summarizeArmy(list: CombatEntityInstance[]): Partial<Record<CombatEntityId, number>> {
  const counts: Partial<Record<CombatEntityId, number>> = {};
  for (const e of list) {
    if (!e.destroyed) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
  }
  return counts;
}

function fireSide(
  shooters: CombatEntityInstance[],
  targets: CombatEntityInstance[],
  defenseDampen = 1
): { shots: number; damage: number; absorbed: number } {
  if (targets.length === 0) return { shots: 0, damage: 0, absorbed: 0 };

  let totalShots = 0;
  let totalDamage = 0;
  let totalAbsorbed = 0;

  for (const shooter of shooters) {
    const shooterStats = getCombatEntityStats(shooter.type);
    let keepFiring = true;
    let rfGuard = 0;

    while (keepFiring && rfGuard < 20) {
      keepFiring = false;
      rfGuard++;
      totalShots++;

      const target = targets[Math.floor(Math.random() * targets.length)];
      const dmg = shooterStats.isDefense
        ? Math.round(shooter.attack * defenseDampen)
        : shooter.attack;
      totalDamage += dmg;

      if (!target.destroyed) {
        // Classic OGame 1% bounce rule
        if (dmg < target.maxShield * 0.01) {
          totalAbsorbed += dmg;
        } else {
          if (target.shield >= dmg) {
            target.shield -= dmg;
            totalAbsorbed += dmg;
          } else {
            const remaining = dmg - target.shield;
            totalAbsorbed += target.shield;
            target.shield = 0;
            target.hull = Math.max(0, target.hull - remaining);

            if (target.hull <= 0) {
              target.destroyed = true;
            } else if (target.hull < target.maxHull * 0.7) {
              // OGame explosion probability below 70% hull
              const explodeChance = 1 - target.hull / target.maxHull;
              if (Math.random() < explodeChance) {
                target.destroyed = true;
              }
            }
          }
        }
      }

      // OGame rapidfire check
      const rf = shooterStats.rapidfire?.[target.type];
      if (rf && rf > 1) {
        const chance = (rf - 1) / rf;
        if (Math.random() < chance) {
          keepFiring = true;
        }
      }
    }
  }

  return { shots: totalShots, damage: totalDamage, absorbed: totalAbsorbed };
}

function calcLosses(
  initial: Partial<Record<CombatEntityId, number>>,
  remaining: Partial<Record<CombatEntityId, number>>
): Resources {
  const losses: Resources = { steel: 0, munition: 0, fuel: 0 };
  for (const [id, initCount] of Object.entries(initial) as [CombatEntityId, number][]) {
    const lost = Math.max(0, (initCount || 0) - (remaining[id] || 0));
    if (lost <= 0) continue;
    const stats = getCombatEntityStats(id);
    losses.steel += stats.cost.steel * lost;
    losses.munition += stats.cost.munition * lost;
    losses.fuel += stats.cost.fuel * lost;
  }
  return losses;
}

function calculateLoot(defenderResources: Resources, cargoCapacity: number): Resources {
  // Classic OGame: attacker can steal up to 50% of each resource, limited by surviving cargo capacity
  const avail: Resources = {
    steel: Math.floor(defenderResources.steel * 0.5),
    munition: Math.floor(defenderResources.munition * 0.5),
    fuel: Math.floor(defenderResources.fuel * 0.5),
  };

  let cap = Math.max(0, Math.floor(cargoCapacity));
  const loot: Resources = { steel: 0, munition: 0, fuel: 0 };

  // Fair 3-pass OGame loot distribution
  const third = Math.floor(cap / 3);
  const take1S = Math.min(avail.steel, third);
  const take1M = Math.min(avail.munition, third);
  const take1F = Math.min(avail.fuel, third);

  loot.steel += take1S;
  loot.munition += take1M;
  loot.fuel += take1F;
  avail.steel -= take1S;
  avail.munition -= take1M;
  avail.fuel -= take1F;
  cap -= take1S + take1M + take1F;

  if (cap > 0) {
    const half = Math.floor(cap / 2);
    const take2S = Math.min(avail.steel, half);
    loot.steel += take2S;
    avail.steel -= take2S;
    cap -= take2S;

    const take2M = Math.min(avail.munition, cap);
    loot.munition += take2M;
    avail.munition -= take2M;
    cap -= take2M;

    const take2F = Math.min(avail.fuel, cap);
    loot.fuel += take2F;
    avail.fuel -= take2F;
    cap -= take2F;
  }

  if (cap > 0) {
    const extraS = Math.min(avail.steel, cap);
    loot.steel += extraS;
    cap -= extraS;
    const extraM = Math.min(avail.munition, cap);
    loot.munition += extraM;
    cap -= extraM;
    const extraF = Math.min(avail.fuel, cap);
    loot.fuel += extraF;
    cap -= extraF;
  }

  return loot;
}

export interface SimulateCombatParams {
  attackerName: string;
  defenderName: string;
  targetCoords: string;
  attackerUnits: Partial<Record<UnitId, number>>;
  defenderUnits: Partial<Record<UnitId, number>>;
  defenderDefenses: Partial<Record<DefenseId, number>>;
  attackerTech: { weapons: number; armor: number };
  defenderTech: { weapons: number; armor: number };
  defenderResources: Resources;
}

export interface SimulateCombatResult {
  report: CombatReportData;
  attackerSurvivingUnits: Partial<Record<UnitId, number>>;
  defenderSurvivingUnits: Partial<Record<UnitId, number>>;
  defenderFinalDefenses: Partial<Record<DefenseId, number>>;
}

export function simulateCombat(params: SimulateCombatParams): SimulateCombatResult {
  const attackerInitial: Partial<Record<CombatEntityId, number>> = {};
  for (const [id, count] of Object.entries(params.attackerUnits) as [UnitId, number][]) {
    if (count > 0) attackerInitial[id] = count;
  }

  const defenderInitial: Partial<Record<CombatEntityId, number>> = {};
  for (const [id, count] of Object.entries(params.defenderUnits) as [UnitId, number][]) {
    if (count > 0) defenderInitial[id] = count;
  }
  for (const [id, count] of Object.entries(params.defenderDefenses) as [DefenseId, number][]) {
    if (count > 0) defenderInitial[id] = count;
  }

  let attackers = expandArmy(attackerInitial, params.attackerTech.weapons, params.attackerTech.armor);
  let defenders = expandArmy(defenderInitial, params.defenderTech.weapons, params.defenderTech.armor);

  const rounds: CombatRoundReport[] = [];

  const hasMinesweeper = (params.attackerUnits.minesweeper_tank || 0) > 0;
  const hasMedic = (params.attackerUnits.medic_team || 0) > 0;
  const hasRepair = (params.attackerUnits.recovery_team || 0) > 0;

  for (let round = 1; round <= 6; round++) {
    if (attackers.length === 0 || defenders.length === 0) break;

    // Recharge shields each round
    for (const a of attackers) a.shield = a.maxShield;
    for (const d of defenders) d.shield = d.maxShield;

    const atkFire = fireSide(attackers, defenders, 1);
    const defDampen = round === 1 && hasMinesweeper ? 0.65 : 1;
    const defFire = fireSide(defenders, attackers, defDampen);

    attackers = attackers.filter((e) => !e.destroyed);
    defenders = defenders.filter((e) => !e.destroyed);

    rounds.push({
      round,
      attackerShots: atkFire.shots,
      attackerDamage: atkFire.damage,
      defenderAbsorbed: atkFire.absorbed,
      defenderShots: defFire.shots,
      defenderDamage: defFire.damage,
      attackerAbsorbed: defFire.absorbed,
      attackerRemaining: summarizeArmy(attackers),
      defenderRemaining: summarizeArmy(defenders),
    });
  }

  const atkRem = summarizeArmy(attackers);
  const defRem = summarizeArmy(defenders);

  let outcome: 'attacker_win' | 'defender_win' | 'draw' = 'draw';
  if (attackers.length > 0 && defenders.length === 0) {
    outcome = 'attacker_win';
  } else if (attackers.length === 0 && defenders.length > 0) {
    outcome = 'defender_win';
  } else if (attackers.length === 0 && defenders.length === 0) {
    outcome = 'draw';
  }

  // Surviving attacker units & cargo capacity (plus medic / repair recovery)
  const attackerSurvivingUnits: Partial<Record<UnitId, number>> = {};
  let survivingCargo = 0;
  for (const [id, count] of Object.entries(atkRem) as [CombatEntityId, number][]) {
    if (id in UNITS && count > 0) {
      attackerSurvivingUnits[id as UnitId] = count;
    }
  }

  if (attackers.length > 0 && (hasMedic || hasRepair)) {
    for (const [id, initCount] of Object.entries(params.attackerUnits) as [UnitId, number][]) {
      const survived = attackerSurvivingUnits[id] || 0;
      const lost = Math.max(0, (initCount || 0) - survived);
      if (lost <= 0) continue;
      const cat = UNITS[id].category;
      const rate =
        hasMedic && (cat === 'infantry' || cat === 'support')
          ? 0.2
          : hasRepair && (cat === 'armor' || cat === 'artillery')
            ? 0.18
            : 0;
      if (rate > 0) {
        const recovered = Math.floor(lost * rate);
        if (recovered > 0) {
          attackerSurvivingUnits[id] = survived + recovered;
        }
      }
    }
  }

  for (const [id, count] of Object.entries(attackerSurvivingUnits) as [UnitId, number][]) {
    if (count > 0) {
      survivingCargo += UNITS[id].cargo * count;
    }
  }

  const loot: Resources =
    outcome === 'attacker_win'
      ? calculateLoot(params.defenderResources, survivingCargo)
      : { steel: 0, munition: 0, fuel: 0 };

  // Surviving defender units & 70% defense rebuild
  const defenderSurvivingUnits: Partial<Record<UnitId, number>> = {};
  const defenderFinalDefenses: Partial<Record<DefenseId, number>> = {};
  const rebuiltDefenses: Partial<Record<DefenseId, number>> = {};

  for (const [id, count] of Object.entries(defRem) as [CombatEntityId, number][]) {
    if (id in UNITS && count > 0) {
      defenderSurvivingUnits[id as UnitId] = count;
    } else if (id in DEFENSES && count > 0) {
      defenderFinalDefenses[id as DefenseId] = count;
    }
  }

  for (const [id, initCount] of Object.entries(params.defenderDefenses) as [DefenseId, number][]) {
    const survived = defenderFinalDefenses[id] || 0;
    const destroyed = Math.max(0, (initCount || 0) - survived);
    let rebuilt = 0;
    for (let i = 0; i < destroyed; i++) {
      if (Math.random() < 0.7) rebuilt++;
    }
    if (rebuilt > 0) {
      rebuiltDefenses[id] = rebuilt;
      defenderFinalDefenses[id] = survived + rebuilt;
    }
  }

  const report: CombatReportData = {
    attackerName: params.attackerName,
    defenderName: params.defenderName,
    targetCoords: params.targetCoords,
    attackerTech: params.attackerTech,
    defenderTech: params.defenderTech,
    attackerInitial,
    defenderInitial,
    rounds,
    outcome,
    loot,
    attackerLosses: calcLosses(attackerInitial, atkRem),
    defenderLosses: calcLosses(defenderInitial, defRem),
    rebuiltDefenses,
  };

  return {
    report,
    attackerSurvivingUnits,
    defenderSurvivingUnits,
    defenderFinalDefenses,
  };
}
