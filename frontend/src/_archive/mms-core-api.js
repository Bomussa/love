/**
 * MMS Core API Integration
 * Connects to the MMS Core backend server
 * Falls back to LocalApiService if unavailable
 */

class MMSCoreAPI {
  constructor() {
    // استخدام environment variable بدلاً من hardcoded URL
    // Emergent backend يعمل على port 8001
    this.baseURL = import.meta.env.VITE_MMS_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:8001/api';
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

    // استخدام eventBus بدلاً من EventSource المكرر
    const handleNotice = (data) => {
      if (onMessage) onMessage(data);
    };
    
    const handleQueueUpdate = (data) => {
      if (onMessage) onMessage({ type: 'queue_update', ...data });
    };
    
    const handleQueueCall = (data) => {
      if (onMessage) onMessage({ type: 'queue_call', ...data });
    };
    
    // الاشتراك في الأحداث
    const unsubscribe1 = eventBus.on('notice', handleNotice);
    const unsubscribe2 = eventBus.on('queue:update', handleQueueUpdate);
    const unsubscribe3 = eventBus.on('queue:call', handleQueueCall);
    
    console.log('MMS Core SSE connected via eventBus');
    
    // إرجاع كائن يحاكي EventSource
    return {
      close: () => {
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
      }
    };
  }
}

// Export singleton instance
if (typeof window !== 'undefined') {
  window.MMSCoreAPI = new MMSCoreAPI();
}

export default MMSCoreAPI;

