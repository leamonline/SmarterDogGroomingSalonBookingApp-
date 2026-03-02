// API fetch wrapper that automatically includes the auth token
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('petspa_token');

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Basic auto-logout on token expiration / unauthorized
    localStorage.removeItem('petspa_token');
    localStorage.removeItem('petspa_user');
    window.location.href = '/login';
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error: any = new Error(errorBody?.error || `API Request failed: ${response.statusText}`);
    if (errorBody) {
      error.details = errorBody;
    }
    throw error;
  }

  return response.json();
}

// --- API Methods ---

export const api = {
  // Auth
  login: async (credentials: any) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    return res.json();
  },
  updatePassword: (currentPassword: string, newPassword: string) => fetchWithAuth('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  }),

  // Staff
  getStaff: () => fetchWithAuth('/api/staff'),
  createStaff: (data: any) => fetchWithAuth('/api/staff', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Customers
  getCustomers: async (page = 1, limit = 50) => {
    const res = await fetchWithAuth(`/api/customers?page=${page}&limit=${limit}`);
    return res.data ? res.data : res;
  },
  createCustomer: (data: any) => fetchWithAuth('/api/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateCustomer: (id: string, data: any) => fetchWithAuth(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteCustomer: (id: string) => fetchWithAuth(`/api/customers/${id}`, {
    method: 'DELETE',
  }),

  // Appointments
  getAppointments: async (page = 1, limit = 50) => {
    const res = await fetchWithAuth(`/api/appointments?page=${page}&limit=${limit}`);
    return res.data ? res.data : res;
  },

  getNextAvailableSlots: (duration = 60, from = new Date().toISOString()) =>
    fetchWithAuth(`/api/appointments/next-available?duration=${duration}&from=${encodeURIComponent(from)}`),
  createAppointment: (data: any) => fetchWithAuth('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAppointment: (id: string, data: any) => fetchWithAuth(`/api/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteAppointment: (id: string) => fetchWithAuth(`/api/appointments/${id}`, {
    method: 'DELETE',
  }),

  // Services
  getServices: async (page = 1, limit = 50) => {
    const res = await fetchWithAuth(`/api/services?page=${page}&limit=${limit}`);
    return res.data ? res.data : res;
  },
  createService: (data: any) => fetchWithAuth('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateService: (id: string, data: any) => fetchWithAuth(`/api/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteService: (id: string) => fetchWithAuth(`/api/services/${id}`, {
    method: 'DELETE',
  }),

  // Analytics
  getAnalytics: () => fetchWithAuth('/api/analytics'),

  // Settings & Schedule
  getSettings: () => fetchWithAuth('/api/settings'),
  updateSettings: (data: any) => fetchWithAuth('/api/settings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Search
  search: (query: string) => fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`),

  // Notifications
  getNotifications: () => fetchWithAuth('/api/notifications')
};
