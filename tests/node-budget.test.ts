import { describe, expect, it } from 'vitest';
import { Content } from '../src/data/registry';
import { BUDGET, validateTree } from '../src/data/nodes/archetypes';

describe('skill tree budget', () => {
  it('keeps every class tree inside the budget', () => {
    for (const tree of Content.treeList) {
      const report = validateTree(tree);
      expect(report.errors, `${tree.id}: ${report.errors.join('; ')}`).toEqual([]);
      expect(report.ok).toBe(true);
    }
  });

  it('keeps the meta trees inside the budget', () => {
    for (const tree of [Content.graceMirror, Content.inheritanceTree]) {
      const report = validateTree(tree);
      expect(report.errors, `${tree.id}: ${report.errors.join('; ')}`).toEqual([]);
    }
  });

  it('never allows more than three stacks on a multiplier node', () => {
    for (const node of Content.nodeList) {
      if (node.archetype !== 'MULTIPLIER') continue;
      expect(node.maxRank).toBeLessThanOrEqual(BUDGET.maxMultiplierStacks);
    }
  });

  it('keeps the multiplier budget per tree below 3.0', () => {
    for (const tree of Content.treeList) {
      const report = validateTree(tree);
      expect(report.multiplierBudget).toBeLessThanOrEqual(BUDGET.maxMultiplierBudget);
    }
  });

  it('keeps at most 40 active nodes per tree', () => {
    for (const tree of Content.treeList) {
      const report = validateTree(tree);
      expect(report.activeNodes).toBeLessThanOrEqual(BUDGET.maxActiveNodes);
    }
  });

  it('has no cycles in the parent chains', () => {
    for (const tree of Content.treeList) {
      const byId = new Map(tree.nodes.map((n) => [n.id, n]));
      for (const node of tree.nodes) {
        const seen = new Set<string>();
        let current = node;
        while (current.parent) {
          expect(seen.has(current.id)).toBe(false);
          seen.add(current.id);
          const parent = byId.get(current.parent);
          expect(parent).toBeTruthy();
          if (!parent) break;
          current = parent;
        }
      }
    }
  });

  it('uses only real skills, runes and passives', () => {
    for (const node of Content.nodeList) {
      const skill = node.params.skill;
      if (typeof skill === 'string' && skill) {
        expect(Content.skill(skill), `${node.id} -> ${skill}`).toBeTruthy();
      }
      const rune = node.params.rune;
      if (typeof rune === 'string' && rune) {
        const def = Content.skill(String(skill));
        expect(def, `${node.id} -> ${skill}`).toBeTruthy();
        expect(def!.runes.some((r) => r.id === rune), `${node.id} -> ${rune}`).toBe(true);
      }
      const passive = node.params.passive;
      if (typeof passive === 'string' && passive) {
        const owner = Content.classList.find((c) => c.passives.includes(passive));
        expect(owner, `${node.id} -> ${passive}`).toBeTruthy();
      }
    }
  });
});
