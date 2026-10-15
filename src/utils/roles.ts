export type UserRole = 'professor' | 'department_head';

const PROFESSOR_ROLES = new Set(['DOCENTE', 'PROFESSOR', 'PROFESOR']);
const DEPARTMENT_HEAD_ROLES = new Set([
  'JEFE_DEPARTAMENTO',
  'JEFE DEPARTAMENTO',
  'DEPARTMENT_HEAD',
  'ADMIN',
  'ADMINISTRADOR',
  'DIRECTOR',
]);

/**
 * Converts backend role names to the two roles understood by the UI.
 * Unknown or missing roles intentionally return null so they never inherit
 * privileged navigation or routes through a permissive fallback.
 */
export function parseBackendRole(role: unknown): UserRole | null {
  if (typeof role !== 'string' || !role.trim()) return null;

  const normalized = role.trim().toUpperCase();
  if (PROFESSOR_ROLES.has(normalized)) return 'professor';
  if (DEPARTMENT_HEAD_ROLES.has(normalized)) return 'department_head';
  return null;
}

export function findKnownBackendRole(roles: unknown): UserRole | null {
  if (!Array.isArray(roles)) return parseBackendRole(roles);

  for (const role of roles) {
    const parsed = parseBackendRole(role);
    if (parsed) return parsed;
  }
  return null;
}
