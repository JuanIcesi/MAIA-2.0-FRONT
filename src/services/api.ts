import { normalizeCreatedAt } from '../utils/accountTenure';
import { buildApiUrl } from '../config/api';
import { findKnownBackendRole } from '../utils/roles';

export const AUTH_UNAUTHORIZED_EVENT = 'maia:auth:unauthorized';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;

  constructor(
    message: string,
    status?: number,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  roleNames: string[];
  departmentId: string;
}

export interface BackendDepartment {
  id: string;
  name: string;
}

export interface BackendUserProfile {
  id: string;
  name: string;
  email: string;
  roles: string[];
  department?: BackendDepartment | null;
  levelExperienceAIG?: string | null;
  academicArea?: string | null;
  createdAt?: string | null;
}

export interface BackendLoginResponse {
  token: string;
  tokenType?: string;
  expiresInSeconds?: number;
  user: BackendUserProfile;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    idNumber: string;
    name: string;
    email: string;
    role: 'professor' | 'department_head';
    department: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
    academicArea?: string;
    isAdministrator?: boolean;
    createdAt?: string;
  };
}

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      removeAuthToken();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    if (!response.ok) {
      let errorData: Record<string, unknown> | null = null;
      try {
        errorData = await response.json() as Record<string, unknown>;
      } catch {
        // Do not expose an HTML/text error body returned by a proxy or server.
      }
      throw createHttpError(response.status, errorData);
    }

    const text = await response.text();
    if (!text || response.status === 204) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError('El servidor devolvió una respuesta no válida.', response.status, 'INVALID_RESPONSE');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Intenta de nuevo.', undefined, 'TIMEOUT');
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        'No se pudo conectar con el servidor. Intenta de nuevo más tarde.',
        undefined,
        'NETWORK_ERROR',
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    if (response.status === 401) {
      removeAuthToken();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    if (!response.ok) {
      let errorData: Record<string, unknown> | null = null;
      try {
        errorData = await response.json() as Record<string, unknown>;
      } catch {
        // Do not expose an HTML/text error body returned by a proxy or server.
      }
      throw createHttpError(response.status, errorData);
    }

    const text = await response.text();
    if (!text || response.status === 204) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError('El servidor devolvió una respuesta no válida.', response.status, 'INVALID_RESPONSE');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Intenta de nuevo.', undefined, 'TIMEOUT');
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        'No se pudo conectar con el servidor. Intenta de nuevo más tarde.',
        undefined,
        'NETWORK_ERROR',
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function validationMessage(errorData: Record<string, unknown> | null): string | null {
  if (!errorData) return null;
  if (errorData.errors && typeof errorData.errors === 'object') {
    const firstError = Object.values(errorData.errors)[0];
    if (typeof firstError === 'string' && firstError.trim()) return firstError;
  }
  for (const key of ['message', 'error']) {
    const value = errorData[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function createHttpError(status: number, errorData: Record<string, unknown> | null): ApiError {
  if ([400, 409, 422].includes(status)) {
    return new ApiError(
      validationMessage(errorData) ?? 'La solicitud contiene datos inválidos.',
      status,
      'VALIDATION_ERROR',
    );
  }
  if (status === 401) return new ApiError('Tu sesión expiró. Inicia sesión nuevamente.', status, 'UNAUTHORIZED');
  if (status === 403) return new ApiError('No tienes permiso para realizar esta acción.', status, 'FORBIDDEN');
  if (status === 404) return new ApiError('No se encontró el recurso solicitado.', status, 'NOT_FOUND');
  if (status >= 500) return new ApiError('El servicio no está disponible en este momento.', status, 'SERVER_ERROR');
  return new ApiError('No fue posible completar la solicitud.', status, 'HTTP_ERROR');
}

function mapBackendExperienceLevel(
  value?: string | null,
): LoginResponse['user']['experienceLevel'] | undefined {
  if (!value?.trim()) return undefined;
  const key = value.trim().toLowerCase();
  if (key.includes('princip') || key === 'beginner') return 'beginner';
  if (key.includes('inter') || key === 'intermediate') return 'intermediate';
  if (key.includes('avan') || key === 'advanced') return 'advanced';
  return undefined;
}

export function mapBackendUserToFrontend(backendUser: BackendUserProfile): LoginResponse['user'] {
  const roles = backendUser.roles ?? [];
  const role = findKnownBackendRole(roles);
  if (!role) {
    throw new ApiError(
      'Tu cuenta no tiene un rol válido para acceder a MAIA.',
      403,
      'INVALID_ROLE',
    );
  }
  return {
    id: backendUser.id,
    idNumber: backendUser.email,
    name: backendUser.name,
    email: backendUser.email,
    role,
    department: backendUser.department?.name?.trim() ?? '',
    experienceLevel: mapBackendExperienceLevel(backendUser.levelExperienceAIG),
    academicArea: backendUser.academicArea?.trim() || undefined,
    isAdministrator: roles.some((r) => r.toUpperCase() === 'ADMINISTRADOR'),
    createdAt:
      normalizeCreatedAt(backendUser.createdAt) ??
      normalizeCreatedAt((backendUser as { created_at?: unknown }).created_at),
  };
}

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const backendResponse = await apiRequest<BackendLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const frontendResponse: LoginResponse = {
      token: backendResponse.token,
      user: mapBackendUserToFrontend(backendResponse.user),
    };

    setAuthToken(backendResponse.token);

    return frontendResponse;
  },

  // Register only creates the user; it does NOT log in or return user info
  // The frontend will perform a login right after a successful registration
  register: async (data: RegisterRequest): Promise<void> => {
    const registerData = {
      ...data,
      roleNames: data.roleNames || [], 
    };
    
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData),
    });
  },

  logout: (): void => {
    removeAuthToken();
  },

};

// ===================== DEPARTMENTS API =====================

export interface Department {
  id: string;
  name: string;
}

export const departmentsAPI = {
  getAll: async (): Promise<Department[]> => {
    return apiRequest<Department[]>('/api/departments');
  },
};

// ===================== USERS API (perfil) =====================

export const usersAPI = {
  getMe: async (): Promise<LoginResponse['user']> => {
    const profile = await apiRequest<BackendUserProfile>('/api/users/me');
    return mapBackendUserToFrontend(profile);
  },

  updateMyDepartment: async (departmentId: string): Promise<LoginResponse['user']> => {
    const profile = await apiRequest<BackendUserProfile>('/api/users/me/department', {
      method: 'PUT',
      body: JSON.stringify({ departmentId }),
    });
    return mapBackendUserToFrontend(profile);
  },

  updateMyProfilePreferences: async (payload: {
    levelExperienceAIG?: string;
    academicArea?: string;
  }): Promise<LoginResponse['user']> => {
    const profile = await apiRequest<BackendUserProfile>('/api/users/me/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return mapBackendUserToFrontend(profile);
  },

  changePassword: async (payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiRequest('/api/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

// ===================== SHARED TYPES =====================

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ===================== RESOURCES API =====================

export const resourcesAPI = {
  getAll: async () => {
    return apiRequest('/api/library/resources');
  },

  getById: async (id: string) => {
    return apiRequest(`/api/library/resources/${id}`);
  },

  getFiltered: async (aiasLevel?: string, discipline?: string, activityType?: string) => {
    const params = new URLSearchParams();

    if (aiasLevel && aiasLevel !== 'all') params.append('aiasLevel', aiasLevel);
    if (discipline && discipline !== 'all') params.append('discipline', discipline);
    if (activityType && activityType !== 'all') params.append('activityType', activityType);

    return apiRequest(`/api/resources/filter?${params.toString()}`);
  },

  create: async (resource: Record<string, unknown>) => {
    return apiRequest('/api/library/resources', {
      method: 'POST',
      body: JSON.stringify(resource),
    });
  },

  getMyResources: async () => {
    return apiRequest('/api/library/my-resources');
  },

  uploadAttachment: async (id: string, file: File): Promise<{ path?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload(`/api/library/resources/${id}/upload`, formData);
  },

  update: async (id: string, resource: any) => {
    return apiRequest(`/api/library/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  },

  delete: async (id: string) => {
    return apiRequest(`/api/library/resources/${id}`, {
      method: 'DELETE',
    });
  },
};

export interface CreateRequestDTO {
  requesterId: string;
  title: string;
  description: string;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  contactEmail: string;
  contactPhone: string;
}

export interface RequestSummary {
  id: string;
  requesterName: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  departmentName?: string;
}

export interface MyRequestSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
}

export interface RequestDetail {
  id: string;
  requesterName: string;
  departmentName?: string;
  assigneeName?: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  responseText?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface RespondRequestDTO {
  responseText: string;
}

export interface RequestStats {
  recibidas: number;
  contestadas: number;
}

// ... existing code ...

export const supportRequestsAPI = {
  getAll: async (_assigneeId?: string, status?: string): Promise<RequestSummary[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<RequestSummary[]>(`/api/requests${query}`);
  },

  getById: async (id: string): Promise<RequestDetail> => {
    return apiRequest<RequestDetail>(`/api/requests/${id}`);
  },

  getMyRequests: async (requesterId: string): Promise<MyRequestSummary[]> => {
    return apiRequest<MyRequestSummary[]>(`/api/requests/my/${requesterId}`);
  },

  create: async (request: CreateRequestDTO): Promise<void> => {
    await apiRequest('/api/requests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  respond: async (id: string, response: RespondRequestDTO): Promise<void> => {
    await apiRequest(`/api/requests/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(response),
    });
  },

  getStats: async (_assigneeId?: string): Promise<RequestStats> => {
    return apiRequest<RequestStats>('/api/requests/stats');
  },

  admin: {
    getAll: async (status: string, departmentId?: string): Promise<RequestSummary[]> => {
      const params = new URLSearchParams({ status });
      if (departmentId) params.append('departmentId', departmentId);
      return apiRequest<RequestSummary[]>(`/api/admin/requests?${params.toString()}`);
    },

    getStats: async (departmentId?: string): Promise<RequestStats> => {
      const params = new URLSearchParams();
      if (departmentId) params.append('departmentId', departmentId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<RequestStats>(`/api/admin/requests/stats${query}`);
    },
  },
};

export interface DepartmentDashboardDTO {
  totalUsers: number;
  activeUsers: number;
  chatInteractions: number;
  conversations: number;
  requestsRecibidas: number;
  requestsEnProceso: number;
  requestsResueltas: number;
  departmentUsers?: number;
}

export interface UsageDataPointDTO {
  date: string;
  count: number;
}

export interface AnalyticsUsageDTO {
  period: string;
  dataPoints: UsageDataPointDTO[];
}

export interface TopicDTO {
  topic: string;
  count: number;
}

export type AnalyticsPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export const analyticsAPI = {
  getDashboard: (period: AnalyticsPeriod = 'MONTH'): Promise<DepartmentDashboardDTO> =>
    apiRequest<DepartmentDashboardDTO>(`/api/analytics/dashboard?period=${period}`),

  getUsage: (period: AnalyticsPeriod = 'MONTH'): Promise<AnalyticsUsageDTO> =>
    apiRequest<AnalyticsUsageDTO>(`/api/analytics/usage?period=${period}`),

  getTopics: (period: AnalyticsPeriod = 'MONTH', limit = 10): Promise<TopicDTO[]> =>
    apiRequest<TopicDTO[]>(`/api/analytics/topics?period=${period}&limit=${limit}`),
};

// ===================== CHAT INTERACTIONS API =====================

export interface ChatInteraction {
  id: string;
  conversationId: string;
  userId: string;
  question: string;
  answer: string;
  sequenceNumber: number;
  createdAt: string;
}

export interface CreateChatInteractionRequest {
  question: string;
  conversationId?: string;
}

export interface ChatInteractionFilters {
  conversationId?: string;
  fromDate?: string; // ISO datetime string
  toDate?: string; // ISO datetime string
  page?: number;
  size?: number;
}

function normalizePageResponse<T>(
  data: Page<T> | { content?: T[]; items?: T[]; totalElements?: number; totalPages?: number; size?: number; number?: number } | T[],
  fallbackPage: number,
  fallbackSize: number,
): Page<T> {
  if (Array.isArray(data)) {
    return {
      content: data,
      totalElements: data.length,
      totalPages: 1,
      size: fallbackSize,
      number: fallbackPage,
    };
  }

  const content = data.content ?? (data as any).items ?? [];
  const totalElements = typeof data.totalElements === 'number' ? data.totalElements : content.length;
  const size = typeof data.size === 'number' ? data.size : fallbackSize;
  const number = typeof data.number === 'number' ? data.number : fallbackPage;
  const totalPages =
    typeof data.totalPages === 'number'
      ? data.totalPages
      : Math.max(1, Math.ceil(totalElements / Math.max(size, 1)));

  return {
    content,
    totalElements,
    totalPages,
    size,
    number,
  };
}

export const chatAPI = {
  createInteraction: async (
    payload: CreateChatInteractionRequest,
  ): Promise<ChatInteraction> => {
    return apiRequest<ChatInteraction>('/api/chat/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyInteractions: async (
    filters: ChatInteractionFilters = {},
  ): Promise<Page<ChatInteraction>> => {
    const params = new URLSearchParams();

    if (filters.conversationId) {
      params.append('conversationId', filters.conversationId);
    }
    if (filters.fromDate) {
      params.append('fromDate', filters.fromDate);
    }
    if (filters.toDate) {
      params.append('toDate', filters.toDate);
    }
    if (typeof filters.page === 'number') {
      params.append('page', String(filters.page));
    }
    if (typeof filters.size === 'number') {
      params.append('size', String(filters.size));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiRequest<any>(`/api/chat/interactions/me${query}`);
    return normalizePageResponse<ChatInteraction>(raw, filters.page ?? 0, filters.size ?? 10);
  },

  getUserInteractions: async (
    userId: string,
    filters: ChatInteractionFilters = {},
  ): Promise<Page<ChatInteraction>> => {
    const params = new URLSearchParams();

    if (filters.conversationId) {
      params.append('conversationId', filters.conversationId);
    }
    if (filters.fromDate) {
      params.append('fromDate', filters.fromDate);
    }
    if (filters.toDate) {
      params.append('toDate', filters.toDate);
    }
    if (typeof filters.page === 'number') {
      params.append('page', String(filters.page));
    }
    if (typeof filters.size === 'number') {
      params.append('size', String(filters.size));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiRequest<any>(
      `/api/chat/interactions/user/${encodeURIComponent(userId)}${query}`,
    );
    return normalizePageResponse<ChatInteraction>(raw, filters.page ?? 0, filters.size ?? 10);
  },

  /** Historial de otro usuario por correo (admin / jefe de departamento). */
  getUserInteractionsByEmail: async (
    email: string,
    filters: ChatInteractionFilters = {},
  ): Promise<Page<ChatInteraction>> => {
    const params = new URLSearchParams();

    if (filters.conversationId) {
      params.append('conversationId', filters.conversationId);
    }
    if (filters.fromDate) {
      params.append('fromDate', filters.fromDate);
    }
    if (filters.toDate) {
      params.append('toDate', filters.toDate);
    }
    if (typeof filters.page === 'number') {
      params.append('page', String(filters.page));
    }
    if (typeof filters.size === 'number') {
      params.append('size', String(filters.size));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiRequest<any>(
      `/api/chat/interactions/user/by-email/${encodeURIComponent(email.trim())}${query}`,
    );
    return normalizePageResponse<ChatInteraction>(raw, filters.page ?? 0, filters.size ?? 10);
  },

  getInteractionById: async (interactionId: string): Promise<ChatInteraction> => {
    return apiRequest<ChatInteraction>(
      `/api/chat/interactions/${encodeURIComponent(interactionId)}`,
    );
  },
};

// ===================== FAVORITES API =====================

export interface FavoriteResourceDTO {
  id: string;
  resourceId: string;
  title?: string;
  description?: string;
  type?: string;
  level?: string;
  aiasLevel?: string;
  category?: string;
  discipline?: string;
  activity?: string;
  activityType?: string;
  dateAdded?: string;
  url?: string;
  attachmentPath?: string;
}

export interface FavoriteToggleResponse {
  resourceId: string;
  isFavorite: boolean;
  message: string;
}

export interface FavoriteStatusResponse {
  resourceId: string;
  isFavorite: boolean;
}

export const favoritesAPI = {
  /** Toggle a resource as favorite/unfavorite */
  toggle: async (resourceId: string): Promise<FavoriteToggleResponse> => {
    return apiRequest<FavoriteToggleResponse>(`/api/favorites/${resourceId}/toggle`, {
      method: 'POST',
    });
  },

  /** Get all favorite resources for the current user */
  getAll: async (): Promise<FavoriteResourceDTO[]> => {
    return apiRequest<FavoriteResourceDTO[]>('/api/favorites');
  },

  /** Check if a specific resource is a favorite */
  getStatus: async (resourceId: string): Promise<FavoriteStatusResponse> => {
    return apiRequest<FavoriteStatusResponse>(`/api/favorites/${resourceId}/status`);
  },
};

// ===================== FAVORITE LISTS (COLLECTIONS) API =====================

export interface FavoriteListDTO {
  id: string;
  name: string;
  resourceCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FavoriteListDetailDTO {
  id: string;
  name: string;
  resources: FavoriteResourceDTO[];
  createdAt?: string;
  updatedAt?: string;
}

export const favoriteListsAPI = {
  /** Create a new favorite list */
  create: async (name: string): Promise<FavoriteListDTO> => {
    return apiRequest<FavoriteListDTO>('/api/favorites/lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /** Get all lists for the current user */
  getAll: async (): Promise<FavoriteListDTO[]> => {
    return apiRequest<FavoriteListDTO[]>('/api/favorites/lists');
  },

  /** Get list detail with resources */
  getDetail: async (listId: string): Promise<FavoriteListDetailDTO> => {
    return apiRequest<FavoriteListDetailDTO>(`/api/favorites/lists/${listId}`);
  },

  /** Update a list name */
  updateName: async (listId: string, name: string): Promise<FavoriteListDTO> => {
    return apiRequest<FavoriteListDTO>(`/api/favorites/lists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  /** Delete a list */
  delete: async (listId: string): Promise<void> => {
    await apiRequest(`/api/favorites/lists/${listId}`, {
      method: 'DELETE',
    });
  },

  /** Add a resource to a list */
  addResource: async (listId: string, resourceId: string): Promise<FavoriteListDetailDTO> => {
    return apiRequest<FavoriteListDetailDTO>(`/api/favorites/lists/${listId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    });
  },

  /** Remove a resource from a list */
  removeResource: async (listId: string, resourceId: string): Promise<void> => {
    await apiRequest(`/api/favorites/lists/${listId}/resources/${resourceId}`, {
      method: 'DELETE',
    });
  },
};

// ===================== NOTIFICATIONS API =====================

export type NotificationType =
  | 'REQUEST_RESPONDED'
  | 'PASSWORD_RESET'
  | 'SURVEY_AVAILABLE'
  | 'SURVEY_REMINDER';

export function isSurveyNotification(type: NotificationType): boolean {
  return type === 'SURVEY_AVAILABLE' || type === 'SURVEY_REMINDER';
}

export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  requestId?: string | null;
  createdAt: string;
}

/** Jackson puede serializar el campo booleano como "read" en lugar de "isRead". */
export function normalizeNotificationDTO(raw: NotificationDTO & { read?: boolean }): NotificationDTO {
  return {
    ...raw,
    isRead: raw.isRead === true || raw.read === true,
  };
}

export interface UnreadCountDTO {
  count: number;
}

export const notificationsAPI = {
  getAll: async (userId: string): Promise<NotificationDTO[]> => {
    const data = await apiRequest<(NotificationDTO & { read?: boolean })[]>(
      `/api/notifications?userId=${encodeURIComponent(userId)}`,
    );
    return data.map(normalizeNotificationDTO);
  },

  getUnreadCount: async (userId: string): Promise<UnreadCountDTO> => {
    return apiRequest<UnreadCountDTO>(`/api/notifications/unread-count?userId=${encodeURIComponent(userId)}`);
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PUT',
    });
  },

  markAsUnread: async (notificationId: string): Promise<void> => {
    await apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/unread`, {
      method: 'PUT',
    });
  },

  markAllAsRead: async (userId: string): Promise<void> => {
    await apiRequest(`/api/notifications/mark-all-read?userId=${encodeURIComponent(userId)}`, {
      method: 'PUT',
    });
  },
};

// Surveys API
export type SurveyQuestionType = 'RATING' | 'TEXT';

export interface SurveyQuestionDTO {
  id?: string;
  text: string;
  questionType: SurveyQuestionType;
  sortOrder: number;
  required: boolean;
}

export interface SurveyTemplateDTO {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestionDTO[];
}

export interface SurveyInstanceDTO {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  status: 'ACTIVE' | 'CLOSED';
  opensAt: string;
  closesAt: string;
  remindersSent: number;
  createdAt: string;
  totalInvitations: number;
  completedInvitations: number;
}

export interface PendingSurveyDTO {
  invitationId: string;
  instanceId: string;
  title: string;
  templateName: string;
  closesAt: string;
  questions: SurveyQuestionDTO[];
}

export interface SurveyReportDTO {
  instanceId: string;
  title: string;
  templateName: string;
  opensAt: string;
  closesAt: string;
  totalInvitations: number;
  completedInvitations: number;
  responseRatePercent: number;
  averageSatisfaction: number;
  ratingDistribution: Record<number, number>;
  questionMetrics: {
    questionId: string;
    questionText: string;
    questionType: string;
    averageRating: number | null;
    responseCount: number;
  }[];
}

export const surveysAPI = {
  getPending: async (): Promise<PendingSurveyDTO[]> => {
    return apiRequest<PendingSurveyDTO[]>('/api/surveys/pending');
  },

  respond: async (invitationId: string, answers: { questionId: string; ratingValue?: number; textValue?: string }[]): Promise<void> => {
    await apiRequest(`/api/surveys/${encodeURIComponent(invitationId)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  admin: {
    listTemplates: async (): Promise<SurveyTemplateDTO[]> => {
      return apiRequest<SurveyTemplateDTO[]>('/api/admin/surveys/templates');
    },

    getTemplate: async (id: string): Promise<SurveyTemplateDTO> => {
      return apiRequest<SurveyTemplateDTO>(`/api/admin/surveys/templates/${encodeURIComponent(id)}`);
    },

    createTemplate: async (payload: {
      name: string;
      description?: string;
      active?: boolean;
      intervalDays?: number;
      questions: SurveyQuestionDTO[];
    }): Promise<SurveyTemplateDTO> => {
      return apiRequest<SurveyTemplateDTO>('/api/admin/surveys/templates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    updateTemplate: async (id: string, payload: {
      name: string;
      description?: string;
      active: boolean;
      intervalDays: number;
      questions: SurveyQuestionDTO[];
    }): Promise<SurveyTemplateDTO> => {
      return apiRequest<SurveyTemplateDTO>(`/api/admin/surveys/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },

    deleteTemplate: async (id: string): Promise<void> => {
      await apiRequest(`/api/admin/surveys/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    listInstances: async (): Promise<SurveyInstanceDTO[]> => {
      return apiRequest<SurveyInstanceDTO[]>('/api/admin/surveys/instances');
    },

    generateInstance: async (
      templateId: string,
      departmentId?: string,
    ): Promise<SurveyInstanceDTO> => {
      const params = new URLSearchParams();
      if (departmentId) params.append('departmentId', departmentId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest<SurveyInstanceDTO>(
        `/api/admin/surveys/templates/${encodeURIComponent(templateId)}/generate${query}`,
        { method: 'POST' },
      );
    },

    getReport: async (instanceId: string): Promise<SurveyReportDTO> => {
      return apiRequest<SurveyReportDTO>(`/api/admin/surveys/instances/${encodeURIComponent(instanceId)}/report`);
    },
  },
};

export default {
  auth: authAPI,
  departments: departmentsAPI,
  users: usersAPI,
  resources: resourcesAPI,
  supportRequests: supportRequestsAPI,
  analytics: analyticsAPI,
  chat: chatAPI,
  favorites: favoritesAPI,
  favoriteLists: favoriteListsAPI,
  notifications: notificationsAPI,
  surveys: surveysAPI,
};

