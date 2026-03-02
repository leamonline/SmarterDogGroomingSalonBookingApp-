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
    throw new Error(errorBody?.error || `API Request failed: ${response.statusText}`);
  }

  return response.json();
}

// --- API Methods ---

export const api = {
  // Customers
  getCustomers: () => fetchWithAuth('/api/customers'),
  createCustomer: (data: any) => fetchWithAuth('/api/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateCustomer: (id: string, data: any) => fetchWithAuth(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Appointments
  getAppointments: () => fetchWithAuth('/api/appointments'),
  createAppointment: (data: any) => fetchWithAuth('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAppointment: (id: string, data: any) => fetchWithAuth(`/api/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Services
  getServices: () => fetchWithAuth('/api/services'),
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
