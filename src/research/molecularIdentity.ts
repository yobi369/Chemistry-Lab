import { SimulationInputError } from './gillespie';
import { parseChemicalFormula } from './formula';

export type BondOrder = 1 | 1.5 | 2 | 3;
export interface MolecularAtom {
  readonly id: string;
  readonly element: string;
  readonly formalCharge?: number;
  /** Optional atom-level stereochemical annotation supplied by an external editor. */
  readonly stereochemistry?: string;
  readonly isotopeMass?: number;
}
export interface MolecularBond {
  readonly atomA: string;
  readonly atomB: string;
  readonly order: BondOrder;
  readonly stereochemistry?: string;
}
export interface MolecularStructure {
  readonly structureId: string;
  readonly atoms: readonly MolecularAtom[];
  readonly bonds: readonly MolecularBond[];
  /** Optional canonical external identifier, e.g. an InChIKey from a trusted cheminformatics tool. */
  readonly inchiKey?: string;
  /** Original or canonical SMILES supplied by an external structure editor; not canonicalised here. */
  readonly smiles?: string;
  readonly source: string;
}
export interface MolecularStructureValidation {
  readonly valid: boolean;
  readonly computedFormula: string;
  readonly formalCharge: number;
  readonly connectedComponents: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Validate an explicit atom/bond graph and formula consistency. This does not
 * perform chemical valence perception, tautomer normalisation, stereochemical
 * assignment or canonical SMILES/InChI generation; use a validated chemistry
 * toolkit for those operations.
 */
export function validateMolecularStructure(
  structure: MolecularStructure,
  expectedFormula?: string,
  expectedCharge?: number,
): MolecularStructureValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!structure.structureId.trim() || !structure.source.trim()) errors.push('Structure id and provenance source are required.');
  if (!Array.isArray(structure.atoms) || structure.atoms.length === 0) errors.push('A molecular graph must contain at least one atom.');
  const atomIds = new Set<string>();
  const composition: Record<string, number> = {};
  let charge = 0;
  for (const atom of structure.atoms ?? []) {
    if (!atom.id.trim() || atomIds.has(atom.id)) errors.push(`Atom id "${atom.id}" is empty or duplicated.`);
    atomIds.add(atom.id);
    try {
      // Validate element symbol and use the periodic-table-backed formula parser.
      const parsed = parseChemicalFormula(atom.element);
      if (Object.keys(parsed).length !== 1 || parsed[atom.element] !== 1) errors.push(`Invalid element symbol "${atom.element}".`);
      else composition[atom.element] = (composition[atom.element] ?? 0) + 1;
    } catch { errors.push(`Invalid element symbol "${atom.element}".`); }
    const atomCharge = atom.formalCharge ?? 0;
    if (!Number.isSafeInteger(atomCharge)) errors.push(`Atom "${atom.id}" has a non-integer formal charge.`);
    else charge += atomCharge;
    if (atom.isotopeMass !== undefined && (!Number.isSafeInteger(atom.isotopeMass) || atom.isotopeMass < 1)) {
      errors.push(`Atom "${atom.id}" has an invalid isotope mass number.`);
    }
  }
  const edges = new Set<string>();
  const adjacency = new Map<string, string[]>([...atomIds].map(id => [id, []]));
  for (const bond of structure.bonds ?? []) {
    if (!atomIds.has(bond.atomA) || !atomIds.has(bond.atomB) || bond.atomA === bond.atomB) {
      errors.push(`Bond "${bond.atomA}–${bond.atomB}" has an invalid endpoint.`);
      continue;
    }
    const edge = [bond.atomA, bond.atomB].sort().join('|');
    if (edges.has(edge)) errors.push(`Duplicate bond between "${bond.atomA}" and "${bond.atomB}".`);
    edges.add(edge);
    if (![1, 1.5, 2, 3].includes(bond.order)) errors.push('Bond order must be 1, 1.5, 2 or 3.');
    adjacency.get(bond.atomA)!.push(bond.atomB);
    adjacency.get(bond.atomB)!.push(bond.atomA);
  }
  let components = 0;
  const visited = new Set<string>();
  for (const id of atomIds) {
    if (visited.has(id)) continue;
    components += 1;
    const stack = [id];
    visited.add(id);
    while (stack.length) {
      const current = stack.pop()!;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!visited.has(neighbour)) { visited.add(neighbour); stack.push(neighbour); }
      }
    }
  }
  const formula = Object.keys(composition).sort().map(element =>
    `${element}${composition[element] === 1 ? '' : composition[element]}`,
  ).join('');
  if (expectedFormula) {
    try {
      const expected = parseChemicalFormula(expectedFormula);
      const same = Object.keys(expected).length === Object.keys(composition).length &&
        Object.entries(expected).every(([element, count]) => composition[element] === count);
      if (!same) errors.push(`Atom graph formula does not match expected formula "${expectedFormula}".`);
    } catch { errors.push(`Expected formula "${expectedFormula}" is invalid.`); }
  }
  if (expectedCharge !== undefined && charge !== expectedCharge) {
    errors.push(`Atom formal-charge sum ${charge} does not match expected charge ${expectedCharge}.`);
  }
  if (structure.inchiKey && !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(structure.inchiKey)) {
    errors.push('InChIKey must use the standard 14-10-1 uppercase block format.');
  }
  if (structure.smiles && !structure.smiles.trim()) warnings.push('An empty SMILES string was supplied.');
  if (components > 1) warnings.push('Structure contains multiple disconnected components; salts and solvates may be intentional.');
  if (!structure.inchiKey) warnings.push('No externally generated InChIKey supplied; graph identity is not canonical.');
  if (!structure.smiles) warnings.push('No SMILES provenance supplied.');
  return { valid: errors.length === 0, computedFormula: formula, formalCharge: charge,
    connectedComponents: components, warnings, errors };
}
