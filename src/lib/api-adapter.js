/**
 * API Adapter - Progressive Integration Layer
 * Gradually migrates from LocalAPI to MMS Core API
 * Provides seamless fallback mechanism
 */

import MMSCoreAPI from './mms-core-api.js';

class APIAdapter {
  constructor() {
    this.mmsCore = new MMSCoreAPI();
    this.localApi = null; // Will be set if needed
    this.useCore = false;
    this.init();
  }

  async init() {
    // Check if MMS Core is available
    this.useCore = await this.mmsCore.checkAvailability();
    
    if (!this.useCore) {

      // Import LocalApiService only if needed
      if (typeof window !== 'undefined' && window.LocalApiService) {
        this.localApi = new window.LocalApiService();
      }
    } else {

    }
  }

  // PIN Operations
  async issuePin(clinicId, visitId = null) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.issuePin(clinicId, visitId);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core PIN issue failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.generatePin(clinicId);
    }
    
    throw new Error('No API available');
  }

  async validatePin(clinicId, pin, dateKey = null) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.validatePin(
          clinicId, 
          dateKey || new Date().toISOString().split('T')[0], 
          pin
        );
        return result;
      } catch (error) {
        // // // // console.error('MMS Core PIN validation failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.validatePin(clinicId, pin);
    }
    
    throw new Error('No API available');
  }

  // Queue Operations
  async enterQueue(clinicId, visitId) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.enterQueue(clinicId, visitId);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core queue enter failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.enterQueue(clinicId, visitId);
    }
    
    throw new Error('No API available');
  }

  async completeQueue(clinicId, visitId, ticket) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.completeQueue(clinicId, visitId, ticket);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core queue complete failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.completeQueue(clinicId, visitId);
    }
    
    throw new Error('No API available');
  }

  async getQueueStatus(clinicId) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.getQueueStatus(clinicId);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core queue status failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.getQueueStatus(clinicId);
    }
    
    throw new Error('No API available');
  }

  // Route Operations
  async assignRoute(visitId, examType, gender = null) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.assignRoute(visitId, examType, gender);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core route assign failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.assignRoute(visitId, examType, gender);
    }
    
    throw new Error('No API available');
  }

  async getRoute(visitId) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.getRoute(visitId);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core get route failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.getRoute(visitId);
    }
    
    throw new Error('No API available');
  }

  async unlockNextStep(visitId, currentClinicId) {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.unlockNextStep(visitId, currentClinicId);
        return result;
      } catch (error) {
        // // // // console.error('MMS Core unlock next failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return this.localApi.unlockNextStep(visitId, currentClinicId);
    }
    
    throw new Error('No API available');
  }

  // System Info
  async getClinics() {
    if (this.useCore) {
      try {
        const result = await this.mmsCore.getClinics();
        return result;
      } catch (error) {
        // // // // console.error('MMS Core get clinics failed, falling back to local');
        this.useCore = false;
      }
    }
    
    // Fallback to local
    if (this.localApi) {
      return { ok: true, clinics: this.localApi.getDefaultClinics() };
    }
    
    throw new Error('No API available');
  }

  async getHealth() {
    if (this.useCore) {
      try {
        return await this.mmsCore.getHealth();
      } catch (error) {
        return { ok: false, error: 'MMS Core unavailable' };
      }
    }
    
    return { ok: true, mode: 'local' };
  }

  // SSE Events
  connectToEvents(onMessage) {
    if (this.useCore) {
      return this.mmsCore.connectToEvents(onMessage);
    }
    return null;
  }

  // Status
  getStatus() {
    return {
      mmsCoreAvailable: this.useCore,
      currentMode: this.useCore ? 'MMS Core' : 'Local Fallback',
      features: {
        pin: true,
        queue: true,
        route: true,
        sse: this.useCore
      }
    };
  }
}

// Export singleton
const apiAdapter = new APIAdapter();

if (typeof window !== 'undefined') {
  window.APIAdapter = apiAdapter;
}

export default apiAdapter;

