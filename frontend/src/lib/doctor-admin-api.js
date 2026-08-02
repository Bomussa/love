async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { success: false, error: 'Invalid server response' };
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.code = payload?.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }

  return payload;
}

const doctorAdminApi = {
  async list() {
    const response = await request('/api/v1/admin/doctors');
    return Array.isArray(response.data) ? response.data : [];
  },

  async save(doctor) {
    return request('/api/v1/admin/doctors/save', {
      method: 'POST',
      body: JSON.stringify(doctor),
    });
  },

  async setStatus(id, isActive) {
    return request(`/api/v1/admin/doctors/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async remove(id) {
    return request(`/api/v1/admin/doctors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

export default doctorAdminApi;
