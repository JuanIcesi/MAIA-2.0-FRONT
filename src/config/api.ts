const LOCAL_API_ORIGIN = 'http://localhost:8080';

export interface ApiBaseUrlOptions {
  configuredUrl?: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  // Endpoints already include /api. Accepting a value copied with that suffix
  // without normalizing it would produce /api/api URLs.
  return trimmed.replace(/\/api$/i, '');
}

export function resolveApiBaseUrl({
  configuredUrl,
  isDevelopment,
  isProduction,
}: ApiBaseUrlOptions): string {
  const normalized = configuredUrl ? normalizeApiOrigin(configuredUrl) : '';

  if (isDevelopment && !normalized) {
    // Relative requests use Vite's local proxy, whose target is localhost:8080.
    return '';
  }

  if (!normalized) {
    throw new Error(
      'Configuración incompleta: define VITE_API_BASE_URL con el origen HTTPS del backend.',
    );
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('VITE_API_BASE_URL debe ser una URL absoluta válida.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_API_BASE_URL solo admite los protocolos HTTP o HTTPS.');
  }

  if (
    isProduction &&
    (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname))
  ) {
    throw new Error(
      'VITE_API_BASE_URL debe usar HTTPS y no puede apuntar a localhost en producción.',
    );
  }

  return normalizeApiOrigin(url.toString());
}

export const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: import.meta.env.VITE_API_BASE_URL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
});

export function buildApiUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

export function buildAttachmentUrl(storagePath: string): string {
  if (/^https:\/\//i.test(storagePath)) return storagePath;

  const normalizedPath = storagePath.replace(/^\/+/, '').replace(/\\/g, '/');
  const encodedPath = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return buildApiUrl(`/api/library/attachments/${encodedPath}`);
}

export { LOCAL_API_ORIGIN };
