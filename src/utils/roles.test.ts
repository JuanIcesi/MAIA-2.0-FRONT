import { describe, expect, it } from 'vitest';
import { findKnownBackendRole, parseBackendRole } from './roles';

describe('role parsing', () => {
  it('maps known professor and department-head aliases', () => {
    expect(parseBackendRole('DOCENTE')).toBe('professor');
    expect(parseBackendRole('profesor')).toBe('professor');
    expect(parseBackendRole('JEFE_DEPARTAMENTO')).toBe('department_head');
    expect(parseBackendRole('ADMINISTRADOR')).toBe('department_head');
  });

  it('rejects missing and unknown roles', () => {
    expect(parseBackendRole(undefined)).toBeNull();
    expect(parseBackendRole('')).toBeNull();
    expect(parseBackendRole('COORDINADOR')).toBeNull();
  });

  it('finds a known role without trusting an unknown first item', () => {
    expect(findKnownBackendRole(['COORDINADOR', 'DOCENTE'])).toBe('professor');
    expect(findKnownBackendRole(['UNKNOWN'])).toBeNull();
  });
});
