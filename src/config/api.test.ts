import { describe, expect, it } from 'vitest';
import { buildAttachmentUrl, resolveApiBaseUrl } from './api';

describe('API URL configuration', () => {
  it('uses the Vite proxy during development when no URL is configured', () => {
    expect(resolveApiBaseUrl({ isDevelopment: true, isProduction: false })).toBe('');
  });

  it('normalizes trailing slash and /api to avoid duplicated prefixes', () => {
    expect(
      resolveApiBaseUrl({
        configuredUrl: 'https://maia-backend.onrender.com/api/',
        isDevelopment: false,
        isProduction: true,
      }),
    ).toBe('https://maia-backend.onrender.com');
  });

  it('rejects missing, local, or insecure production URLs', () => {
    expect(() =>
      resolveApiBaseUrl({ isDevelopment: false, isProduction: true }),
    ).toThrow(/VITE_API_BASE_URL/);
    expect(() =>
      resolveApiBaseUrl({
        configuredUrl: 'http://localhost:8080',
        isDevelopment: false,
        isProduction: true,
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      resolveApiBaseUrl({
        configuredUrl: 'http://backend.example.com',
        isDevelopment: false,
        isProduction: true,
      }),
    ).toThrow(/HTTPS/);
  });

  it('encodes attachment paths and preserves public HTTPS URLs', () => {
    expect(buildAttachmentUrl('folder/My file.pdf')).toBe(
      '/api/library/attachments/folder/My%20file.pdf',
    );
    expect(buildAttachmentUrl('https://cdn.example.com/file.pdf')).toBe(
      'https://cdn.example.com/file.pdf',
    );
  });
});
