/**
 * MMS Core API Integration
 * Connects to the MMS Core backend server
 * Falls back to LocalApiService if unavailable
 */

class MMSCoreAPI {
  constructor() {
    this.baseURL = 'http://localhost:4000/api';
    this.isAvailable = false;
    this.checkAvailability();
  }

  async checkAvailability() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        timeout: 2000
      });
      const data = await response.json();
      this.isAvailable = data.ok === true;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      return false;
    }
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`MMS Core API Error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  // PIN Management
  async issuePin(clinicId, visitId = null) {
    return this.request('/pin/issue', {
      method: 'POST',
      body: JSON.stringify({ clinicId, visitId })
    });
  }

  async validatePin(clinicId, dateKey, pin) {
    return this.request('/pin/validate', {
      method: 'POST',
      body: JSON.stringify({ clinicId, dateKey, pin })
    });
  }

  // Queue Management
  async enterQueue(clinicId, visitId) {
    return this.request('/queue/enter', {
      method: 'POST',
      body: JSON.stringify({ clinicId, visitId })
    });
  }

  async completeQueue(clinicId, visitId, ticket) {
    return this.request('/queue/complete', {
      method: 'POST',
      body: JSON.stringify({ clinicId, visitId, ticket })
    });
  }

  async getQueueStatus(clinicId) {
    return this.request(`/queue/status/${clinicId}`, {
      method: 'GET'
    });
  }

  // Route Management
  async assignRoute(visitId, examType, gender = null) {
    return this.request('/route/assign', {
      method: 'POST',
      body: JSON.stringify({ visitId, examType, gender })
    });
  }

  async unlockNextStep(visitId, currentClinicId) {
    return this.request('/route/next', {
      method: 'POST',
      body: JSON.stringify({ visitId, currentClinicId })
    });
  }

  async getRoute(visitId) {
    return this.request(`/route/${visitId}`, {
      method: 'GET'
    });
  }

  // System Info
  async getClinics() {
    return this.request('/clinics', {
      method: 'GET'
    });
  }

  async getConstants() {
    return this.request('/constants', {
      method: 'GET'
    });
  }

  async getHealth() {
    return this.request('/health', {
      method: 'GET'
    });
  }

  // SSE Events Connection
  connectToEvents(onMessage) {
    if (!this.isAvailable) {
      console.warn('MMS Core not available, SSE disabled');
      return null;
    }

    const eventSource = new EventSource(`${this.baseURL}/events`);

    eventSource.addEventListener('hello', (e) => {
      console.log('MMS Core SSE connected:', e.data);
    });

    eventSource.addEventListener('notice', (e) => {
      const notice = JSON.parse(e.data);
      if (onMessage) onMessage(notice);
    });

    eventSource.addEventListener('queue:update', (e) => {
      const update = JSON.parse(e.data);
      if (onMessage) onMessage({ type: 'queue_update', ...update });
    });

    eventSource.addEventListener('queue:call', (e) => {
      const call = JSON.parse(e.data);
      if (onMessage) onMessage({ type: 'queue_call', ...call });
    });

    eventSource.onerror = (error) => {
      console.error('MMS Core SSE error:', error);
      eventSource.close();
    };

    return eventSource;
  }
}

// Export singleton instance
if (typeof window !== 'undefined') {
  window.MMSCoreAPI = new MMSCoreAPI();
}

export default MMSCoreAPI;

