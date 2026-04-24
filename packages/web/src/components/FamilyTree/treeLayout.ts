import type { TreePerson, LayoutNode, LayoutEdge } from '../../types';

export const NODE_W = 180;
export const NODE_H = 80;
const GEN_GAP = 160;  // vertical gap between generations
const COUPLE_GAP = 20; // gap between spouses
const SIBLING_GAP = 24; // gap between siblings

interface FamilyUnit {
  id: string;
  spouseIds: string[];        // ordered: [primary, ...spouses]
  childIds: string[];
  generation: number;
  x: number;                  // centre x assigned during layout
}

export function computeLayout(persons: TreePerson[]): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
} {
  if (persons.length === 0) return { nodes: [], edges: [] };

  const byId = new Map<string, TreePerson>(persons.map((p) => [p.id, p]));

  // ── 1. Assign generation numbers via BFS from roots (persons with no parents) ──
  const generation = new Map<string, number>();
  const roots = persons.filter((p) => p.parentIds.length === 0).map((p) => p.id);
  // Also include persons whose parents aren't in this dataset
  persons.forEach((p) => {
    const hasParentsInSet = p.parentIds.some((pid) => byId.has(pid));
    if (!hasParentsInSet) roots.push(p.id);
  });
  const uniqueRoots = [...new Set(roots)];

  const queue: Array<{ id: string; gen: number }> = uniqueRoots.map((id) => ({ id, gen: 0 }));
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (generation.has(item.id)) continue;
    generation.set(item.id, item.gen);
    const p = byId.get(item.id);
    if (p) {
      for (const childId of p.childIds) {
        queue.push({ id: childId, gen: item.gen + 1 });
      }
    }
  }
  // Assign generation 0 to anyone not reached
  persons.forEach((p) => {
    if (!generation.has(p.id)) generation.set(p.id, 0);
  });

  // ── 2. Snap spouses to same generation (max of the two) ──
  const visited = new Set<string>();
  persons.forEach((p) => {
    if (visited.has(p.id)) return;
    p.spouses.forEach((s) => {
      const g1 = generation.get(p.id) ?? 0;
      const g2 = generation.get(s.id) ?? 0;
      const g = Math.max(g1, g2);
      generation.set(p.id, g);
      generation.set(s.id, g);
    });
    visited.add(p.id);
  });

  const maxGen = Math.max(0, ...generation.values());

  // ── 3. Build family units (one per unique couple, or solo) ──
  const unitByPerson = new Map<string, string>();  // personId → unitId
  const units = new Map<string, FamilyUnit>();

  const coupleKey = (a: string, b: string) => [a, b].sort().join('|');
  const processedCouples = new Set<string>();

  persons.forEach((p) => {
    if (p.spouses.length === 0) {
      if (!unitByPerson.has(p.id)) {
        const uid = `solo_${p.id}`;
        units.set(uid, {
          id: uid,
          spouseIds: [p.id],
          childIds: p.childIds,
          generation: generation.get(p.id) ?? 0,
          x: 0,
        });
        unitByPerson.set(p.id, uid);
      }
    } else {
      p.spouses.forEach((s) => {
        const key = coupleKey(p.id, s.id);
        if (processedCouples.has(key)) return;
        processedCouples.add(key);

        const sp = byId.get(s.id);
        const combinedChildren = [
          ...new Set([...p.childIds, ...(sp?.childIds ?? [])]),
        ];
        const uid = `couple_${key}`;
        units.set(uid, {
          id: uid,
          spouseIds: [p.id, s.id],
          childIds: combinedChildren,
          generation: generation.get(p.id) ?? 0,
          x: 0,
        });
        unitByPerson.set(p.id, uid);
        unitByPerson.set(s.id, uid);
      });

      // solo unit for persons not yet assigned (multi-spouse handled by first match)
      if (!unitByPerson.has(p.id)) {
        const uid = `solo_${p.id}`;
        units.set(uid, {
          id: uid,
          spouseIds: [p.id],
          childIds: p.childIds,
          generation: generation.get(p.id) ?? 0,
          x: 0,
        });
        unitByPerson.set(p.id, uid);
      }
    }
  });

  // ── 4. Assign x positions generation by generation, bottom-up ──
  // Group units by generation
  const unitsByGen: Map<number, FamilyUnit[]> = new Map();
  units.forEach((unit) => {
    const g = unit.generation;
    if (!unitsByGen.has(g)) unitsByGen.set(g, []);
    unitsByGen.get(g)!.push(unit);
  });

  // Process from deepest generation upward
  const posX = new Map<string, number>(); // personId → final x center

  for (let g = maxGen; g >= 0; g--) {
    const genUnits = unitsByGen.get(g) ?? [];

    // Try to centre each unit over its children
    genUnits.forEach((unit) => {
      if (unit.childIds.length > 0) {
        const childXs = unit.childIds
          .map((cid) => posX.get(cid))
          .filter((x): x is number => x !== undefined);
        if (childXs.length > 0) {
          unit.x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
        }
      }
    });

    // Now space out units in this generation to avoid overlaps
    genUnits.sort((a, b) => a.x - b.x);
    let cursor = 0;
    genUnits.forEach((unit, i) => {
      const unitWidth = unit.spouseIds.length * NODE_W + (unit.spouseIds.length - 1) * COUPLE_GAP;
      const prevMin = i === 0 ? -Infinity : genUnits[i - 1].x + NODE_W + SIBLING_GAP;
      unit.x = Math.max(unit.x, cursor, prevMin);
      cursor = unit.x + unitWidth + SIBLING_GAP;

      // Assign x to each person in the unit
      unit.spouseIds.forEach((pid, idx) => {
        posX.set(pid, unit.x + idx * (NODE_W + COUPLE_GAP));
      });
    });

    // Re-centre parents that weren't positioned above children
    genUnits.forEach((unit) => {
      if (unit.childIds.length === 0 && !posX.has(unit.spouseIds[0])) {
        const unitWidth = unit.spouseIds.length * NODE_W + (unit.spouseIds.length - 1) * COUPLE_GAP;
        unit.x = cursor;
        cursor += unitWidth + SIBLING_GAP;
        unit.spouseIds.forEach((pid, idx) => {
          posX.set(pid, unit.x + idx * (NODE_W + COUPLE_GAP));
        });
      }
    });
  }

  // ── 5. Build LayoutNodes ──
  const nodes: LayoutNode[] = persons.map((p) => ({
    person: p,
    x: posX.get(p.id) ?? 0,
    y: (generation.get(p.id) ?? 0) * (NODE_H + GEN_GAP),
    generation: generation.get(p.id) ?? 0,
    familyUnitId: unitByPerson.get(p.id),
  }));

  // ── 6. Build edges ──
  const edges: LayoutEdge[] = [];
  const edgeSet = new Set<string>();

  nodes.forEach((node) => {
    const p = node.person;

    // Parent-child edges (from parent bottom-center to child top-center)
    p.parentIds.forEach((parentId) => {
      const parentNode = nodes.find((n) => n.person.id === parentId);
      if (!parentNode) return;
      const key = `${parentId}->${p.id}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);

      // Find couple unit for parent to get couple midpoint
      const parentUnit = [...units.values()].find((u) => u.spouseIds.includes(parentId));
      let fromX = parentNode.x + NODE_W / 2;
      if (parentUnit && parentUnit.spouseIds.length > 1) {
        const xs = parentUnit.spouseIds
          .map((sid) => nodes.find((n) => n.person.id === sid)?.x ?? 0)
          .map((x) => x + NODE_W / 2);
        fromX = (Math.min(...xs) + Math.max(...xs)) / 2;
      }

      edges.push({
        type: 'parent-child',
        fromId: parentId,
        toId: p.id,
        x1: fromX,
        y1: parentNode.y + NODE_H,
        x2: node.x + NODE_W / 2,
        y2: node.y,
      });
    });

    // Spouse edges
    p.spouses.forEach((s) => {
      const key = [p.id, s.id].sort().join('<->');
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      const spouseNode = nodes.find((n) => n.person.id === s.id);
      if (!spouseNode) return;

      edges.push({
        type: 'spouse',
        fromId: p.id,
        toId: s.id,
        x1: node.x + NODE_W / 2,
        y1: node.y + NODE_H / 2,
        x2: spouseNode.x + NODE_W / 2,
        y2: spouseNode.y + NODE_H / 2,
      });
    });
  });

  return { nodes, edges };
}
