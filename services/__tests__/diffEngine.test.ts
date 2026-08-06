import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../diffEngine';

describe('DiffEngine', () => {
  it('compares multi-select strings correctly', () => {
    expect(DiffEngine.isMultiSelectEqual('Zysk, MAG', 'MAG, Zysk')).toBe(true);
    expect(DiffEngine.isMultiSelectEqual('Zysk, MAG', 'MAG, Zysk, Rebis')).toBe(false);
    expect(DiffEngine.isMultiSelectEqual('  Zysk  ', 'Zysk')).toBe(true);
    expect(DiffEngine.isMultiSelectEqual('', null as any)).toBe(true);
    // Różnica samej wielkości liter to nie zmiana (Notion i tak scala opcje case-insensitive)
    expect(DiffEngine.isMultiSelectEqual('Zysk i S-ka', 'Zysk i s-ka')).toBe(true);
  });

  it('compares strings correctly', () => {
    expect(DiffEngine.isStringEqual(' Solaris ', 'Solaris')).toBe(true);
    expect(DiffEngine.isStringEqual('Solaris', 'Cyberiada')).toBe(false);
  });
});
