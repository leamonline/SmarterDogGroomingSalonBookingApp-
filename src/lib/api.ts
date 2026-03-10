// API fetch wrapper that automatically includes auth (httpOnly cookie + fallback header)
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  // Fallback: if a token is still in localStorage (pre-migration), send it as a header
  const legacyToken = localStorage.getItem('petspa_token');
  if (legacyToken) {
    headers.set('Authorization', `Bearer ${legacyToken}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send httpOnly cookies
  });

  if (response.status === 401 || response.status === 403) {
    // Auto-logout on missing token (401) or expired/invalid token (403)
    localStorage.removeItem('petspa_token');
    localStorage.removeItem('petspa_user');
    window.location.href = '/login';
    // Throw so calling code doesn't try to parse a non-JSON body
    throw new Error('Session expired — please log in again.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error = new Error(errorBody?.error || `API Request failed: ${response.statusText}`) as Error & { details?: Record<string, unknown> | object };
    if (errorBody) {
      error.details = errorBody;
    }
    throw error;
  }

  return response.json();
}

async function fetchPublicJson(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error = new Error(errorBody?.error || `API Request failed: ${response.statusText}`) as Error & { details?: Record<string, unknown> | object };
    if (errorBody) {
      error.details = errorBody;
    }
    throw error;
  }

  return response.json();
}

/** Unwrap paginated responses: extract `.data` array if present, otherwise return as-is. */
async function fetchPaginatedData(url: string) {
  const res = await fetchWithAuth(url);
  return res.data ? res.data : res;
}

// --- API Methods ---

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    fetchPublicJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  },
  requestPasswordReset: (email: string) =>
    fetchPublicJson('/api/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    fetchPublicJson('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  updatePassword: (currentPassword: string, newPassword: string) => fetchWithAuth('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  }),

  // Staff
  getStaff: () => fetchWithAuth('/api/staff'),
  createStaff: (data: Record<string, unknown> | object) => fetchWithAuth('/api/staff', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStaffRole: (userId: string, role: string) => fetchWithAuth(`/api/staff/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  }),
  getMe: () => fetchWithAuth('/api/auth/me'),

  // Customers
  getCustomersPage: (page = 1, limit = 50) =>
    fetchWithAuth(`/api/customers?page=${page}&limit=${limit}`),
  getCustomers: (page = 1, limit = 50) =>
    fetchPaginatedData(`/api/customers?page=${page}&limit=${limit}`),
  getCustomer: (id: string) => fetchWithAuth(`/api/customers/${id}`),
  createCustomer: (data: Record<string, unknown> | object) => fetchWithAuth('/api/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  lookupAppointmentClients: (params: { ownerName?: string; phone?: string; petName?: string; breed?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.ownerName) query.set('ownerName', params.ownerName);
    if (params.phone) query.set('phone', params.phone);
    if (params.petName) query.set('petName', params.petName);
    if (params.breed) query.set('breed', params.breed);
    if (params.limit) query.set('limit', String(params.limit));
    return fetchWithAuth(`/api/customers/appointment-lookup?${query.toString()}`);
  },
  updateCustomer: (id: string, data: Record<string, unknown> | object) => fetchWithAuth(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteCustomer: (id: string) => fetchWithAuth(`/api/customers/${id}`, {
    method: 'DELETE',
  }),

  // Customer Tags
  getCustomerTags: (customerId: string) => fetchWithAuth(`/api/customers/${customerId}/tags`),
  setCustomerTags: (customerId: string, tags: string[]) => fetchWithAuth(`/api/customers/${customerId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  }),

  // Dog Tags
  getDogTags: (dogId: string) => fetchWithAuth(`/api/dogs/${dogId}/tags`),
  setDogTags: (dogId: string, tags: string[]) => fetchWithAuth(`/api/dogs/${dogId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  }),
  getDogsPage: (page = 1, limit = 50, query?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (query) params.set('q', query);
    return fetchWithAuth(`/api/dogs?${params.toString()}`);
  },
  getDogs: (page = 1, limit = 50, query?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (query) params.set('q', query);
    return fetchPaginatedData(`/api/dogs?${params.toString()}`);
  },
  getDog: (id: string) => fetchWithAuth(`/api/dogs/${id}`),

  // Appointments
  getAppointments: (page = 1, limit = 50) =>
    fetchPaginatedData(`/api/appointments?page=${page}&limit=${limit}`),

  getNextAvailableSlots: (dogCount = 1, from = new Date().toISOString()) =>
    fetchWithAuth(`/api/appointments/next-available?dogCount=${dogCount}&from=${encodeURIComponent(from)}`),
  createAppointment: (data: Record<string, unknown> | object) => fetchWithAuth('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAppointment: (id: string, data: Record<string, unknown> | object) => fetchWithAuth(`/api/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteAppointment: (id: string) => fetchWithAuth(`/api/appointments/${id}`, {
    method: 'DELETE',
  }),

  // Services
  getServices: (page = 1, limit = 50) =>
    fetchPaginatedData(`/api/services?page=${page}&limit=${limit}`),
  createService: (data: Record<string, unknown> | object) => fetchWithAuth('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateService: (id: string, data: Record<string, unknown> | object) => fetchWithAuth(`/api/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteService: (id: string) => fetchWithAuth(`/api/services/${id}`, {
    method: 'DELETE',
  }),

  // Service Add-ons
  getServiceAddOns: (serviceId: string) => fetchWithAuth(`/api/services/${serviceId}/add-ons`),
  setServiceAddOns: (serviceId: string, addOnIds: string[]) => fetchWithAuth(`/api/services/${serviceId}/add-ons`, {
    method: 'POST',
    body: JSON.stringify({ addOnIds }),
  }),

  // Add-ons
  getAddOns: () => fetchWithAuth('/api/add-ons'),
  createAddOn: (data: Record<string, unknown> | object) => fetchWithAuth('/api/add-ons', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAddOn: (id: string, data: Record<string, unknown> | object) => fetchWithAuth(`/api/add-ons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteAddOn: (id: string) => fetchWithAuth(`/api/add-ons/${id}`, {
    method: 'DELETE',
  }),

  // Payments
  getPayments: (appointmentId?: string) =>
    appointmentId
      ? fetchWithAuth(`/api/payments?appointmentId=${appointmentId}`)
      : fetchWithAuth('/api/payments'),
  createPayment: (data: Record<string, unknown> | object) => fetchWithAuth('/api/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Forms & Consent
  getForms: () => fetchWithAuth('/api/forms'),
  createForm: (data: Record<string, unknown> | object) => fetchWithAuth('/api/forms', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateForm: (id: string, data: Record<string, unknown> | object) => fetchWithAuth(`/api/forms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Form Submissions
  getFormSubmissions: (filters?: { formId?: string; customerId?: string; dogId?: string; appointmentId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.formId) params.set('formId', filters.formId);
    if (filters?.customerId) params.set('customerId', filters.customerId);
    if (filters?.dogId) params.set('dogId', filters.dogId);
    if (filters?.appointmentId) params.set('appointmentId', filters.appointmentId);
    return fetchWithAuth(`/api/form-submissions?${params.toString()}`);
  },
  submitForm: (data: Record<string, unknown> | object) => fetchWithAuth('/api/form-submissions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Audit Log
  getAuditLog: (filters?: { entityType?: string; entityId?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (filters?.entityType) params.set('entityType', filters.entityType);
    if (filters?.entityId) params.set('entityId', filters.entityId);
    if (filters?.page) params.set('page', String(filters.page));
    return fetchWithAuth(`/api/audit-log?${params.toString()}`);
  },

  // Analytics
  getAnalytics: () => fetchWithAuth('/api/analytics'),

  // Messaging
  getMessages: (filters?: { limit?: number; customerId?: string; appointmentId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.customerId) params.set('customerId', filters.customerId);
    if (filters?.appointmentId) params.set('appointmentId', filters.appointmentId);
    return fetchWithAuth(`/api/messages?${params.toString()}`);
  },
  sendMessage: (data: { recipientEmail?: string; recipientPhone?: string; channel: 'email' | 'sms'; subject?: string; body: string; customerId?: string; appointmentId?: string }) =>
    fetchWithAuth('/api/messages/send', { method: 'POST', body: JSON.stringify(data) }),

  // Reports (server-side aggregated)
  getReports: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return fetchWithAuth(`/api/reports?${params.toString()}`);
  },

  // Settings & Schedule
  getSettings: () => fetchWithAuth('/api/settings'),
  updateSettings: (data: Record<string, unknown> | object) => fetchWithAuth('/api/settings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Search
  search: (query: string) => fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`),

  // Notifications
  getNotifications: () => fetchWithAuth('/api/notifications')
};
