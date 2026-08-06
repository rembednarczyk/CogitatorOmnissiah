import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../diffEngine';

describe('DiffEngine', () => {
  it('compares multi-select strings correctly', () => {
    expect(DiffEngine.isMultiSelectEqual('Zysk, MAG', 'MAG, Zysk')).toBe(true);
    expect(DiffEngine.isMultiSelectEqual('Zysk, MAG', 'MAG, Zysk, Rebis')).toBe(false);
    expect(DiffEngine.isMultiSelectEqual('  Zysk  ', 'Zysk')).toBe(true);
    expect(DiffEngine.isMultiSelectEqual('', null as any)).toBe(true);
  });

  it('compares strings correctly', () => {
    expect(DiffEngine.isStringEqual(' Solaris ', 'Solaris')).toBe(true);
    expect(DiffEngine.isStringEqual('Solaris', 'Cyberiada')).toBe(false);
  });
});
