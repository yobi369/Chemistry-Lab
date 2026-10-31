import LZString from 'lz-string';
import { PresetSystem } from '../types/chemistry';

/**
 * Compresses a PresetSystem model into a compact base64-URI friendly string.
 */
export function encodeModelToUrl(preset: PresetSystem): string {
  try {
    const minified = {
      n: preset.name,
      d: preset.description,
      c: preset.category,
      t: preset.defaultTemp,
      s: preset.defaultStirSpeed,
      e: preset.initialEnergy,
      m: preset.moleculeTypes.map(m => ({
        i: m.id,
        s: m.symbol,
        n: m.name,
        c: m.color,
        r: m.radius,
        m: m.mass,
        e: m.energyState,
        cat: m.category,
        d: m.description
      })),
      r: preset.reactionRules.map(r => ({
        i: r.id,
        n: r.name,
        re: r.reactants,
        pr: r.products,
        ca: r.catalysts || [],
        ea: r.activationEnergy,
        de: r.energyDelta,
        k: r.rateConstant,
        en: r.enabled !== false
      })),
      ic: preset.initialCounts
    };

    const jsonStr = JSON.stringify(minified);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    return compressed;
  } catch (err) {
    console.error('Failed to encode model to URL:', err);
    return '';
  }
}

/**
 * Decodes a compressed base64-URI string back into a PresetSystem.
 */
export function decodeModelFromUrl(encoded: string): PresetSystem | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (!decompressed) return null;

    const parsed = JSON.parse(decompressed);
    if (!parsed || !parsed.m || !parsed.r) return null;

    const preset: PresetSystem = {
      id: `SHARED_${Date.now()}`,
      name: parsed.n || 'Shared Experiment',
      category: parsed.c || 'Custom User Experiments',
      description: parsed.d || 'Shared via one-click link',
      defaultTemp: parsed.t ?? 300,
      defaultStirSpeed: parsed.s ?? 3,
      initialEnergy: parsed.e ?? 600,
      moleculeTypes: parsed.m.map((m: any) => ({
        id: m.i,
        symbol: m.s,
        name: m.n,
        color: m.c,
        radius: m.r ?? 7,
        mass: m.m ?? 1.0,
        energyState: m.e ?? 20,
        category: m.cat || 'substrate',
        description: m.d || ''
      })),
      reactionRules: parsed.r.map((r: any) => ({
        id: r.i,
        name: r.n,
        reactants: r.re,
        products: r.pr,
        catalysts: r.ca || [],
        activationEnergy: r.ea ?? 10,
        energyDelta: r.de ?? -15,
        rateConstant: r.k ?? 0.75,
        enabled: r.en !== false,
        description: `Rule: ${r.n}`
      })),
      initialCounts: parsed.ic || {}
    };

    return preset;
  } catch (err) {
    console.error('Failed to decode model from URL:', err);
    return null;
  }
}
