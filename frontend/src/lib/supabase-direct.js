/**
 * Supabase Direct API Client
 * اتصال مباشر بـ Supabase REST API بدون Edge Functions
 */

const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

class SupabaseDirectClient {
    constructor() {
        this.baseUrl = `${SUPABASE_URL}/rest/v1`;
        this.headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation'
        };
    }

    // ============================================
    // Generic Request Method
    // ============================================
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: { ...this.headers, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error(`Supabase Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ============================================
    // Dashboard Statistics
    // ============================================
    async getDashboardStats() {
        try {
            // Get queue counts
            const [waiting, completed, allQueue] = await Promise.all([
                this.request('/queue?select=id&status=eq.waiting'),
                this.request('/queue?select=id&status=eq.completed'),
                this.request('/queue?select=id')
            ]);

            // Get active pins count
            const activePins = await this.request('/pins?select=id&is_active=eq.true');

            // Get clinics count
            const clinics = await this.request('/clinics?select=id&is_active=eq.true');

            return {
                success: true,
                totalPatients: allQueue?.length || 0,
                waitingPatients: waiting?.length || 0,
                completedToday: completed?.length || 0,
                activePins: activePins?.length || 0,
                activeClinics: clinics?.length || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Clinics Management
    // ============================================
    async getClinics() {
        try {
            const data = await this.request('/clinics?select=*&order=name_ar.asc');
            return { success: true, clinics: data || [] };
        } catch (error) {
            return { success: false, clinics: [], error: error.message };
        }
    }

    async updateClinic(id, updates) {
        try {
            const data = await this.request(`/clinics?id=eq.${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async toggleClinicStatus(id, isActive) {
        return this.updateClinic(id, { is_active: isActive });
    }

    // ============================================
    // Queue Management
    // ============================================
    async getQueueByClinic(clinicId) {
        try {
            const data = await this.request(`/queue?select=*&clinic_id=eq.${clinicId}&order=position.asc`);
            
            const waiting = data?.filter(q => q.status === 'waiting') || [];
            const inService = data?.filter(q => q.status === 'in_service' || q.status === 'called') || [];
            const completed = data?.filter(q => q.status === 'completed') || [];

            return {
                success: true,
                waiting,
                in: inService,
                done: completed,
                stats: {
                    totalWaiting: waiting.length,
                    totalIn: inService.length,
                    totalDone: completed.length,
                    totalToday: data?.length || 0
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAllQueues() {
        try {
            const data = await this.request('/queue?select=*,clinics(name_ar,name_en)&order=entered_at.desc&limit=100');
            return { success: true, queues: data || [] };
        } catch (error) {
            return { success: false, queues: [], error: error.message };
        }
    }

    async callNextPatient(clinicId) {
        try {
            // Get first waiting patient
            const waiting = await this.request(`/queue?select=*&clinic_id=eq.${clinicId}&status=eq.waiting&order=position.asc&limit=1`);
            
            if (!waiting || waiting.length === 0) {
                return { success: false, error: 'لا يوجد مرضى في الانتظار' };
            }

            const patient = waiting[0];
            
            // Update status to called
            await this.request(`/queue?id=eq.${patient.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'called',
                    called_at: new Date().toISOString()
                })
            });

            return { success: true, patient };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async completePatient(queueId) {
        try {
            await this.request(`/queue?id=eq.${queueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async cancelPatient(queueId) {
        try {
            await this.request(`/queue?id=eq.${queueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resetQueue(clinicId) {
        try {
            await this.request(`/queue?clinic_id=eq.${clinicId}`, {
                method: 'DELETE'
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // PIN Management
    // ============================================
    async getPins() {
        try {
            const data = await this.request('/pins?select=*&order=created_at.desc');
            return { success: true, pins: data || [] };
        } catch (error) {
            return { success: false, pins: [], error: error.message };
        }
    }

    async getPinsByClinic(clinicCode) {
        try {
            const data = await this.request(`/pins?select=*&clinic_code=eq.${clinicCode}&order=created_at.desc`);
            return { success: true, pins: data || [] };
        } catch (error) {
            return { success: false, pins: [], error: error.message };
        }
    }

    async createPin(pinData) {
        try {
            const data = await this.request('/pins', {
                method: 'POST',
                body: JSON.stringify({
                    clinic_code: pinData.clinic_code,
                    pin: pinData.pin,
                    is_active: true,
                    generated_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updatePin(id, updates) {
        try {
            const data = await this.request(`/pins?id=eq.${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async togglePinStatus(id, isActive) {
        return this.updatePin(id, { is_active: isActive });
    }

    async deletePin(id) {
        try {
            await this.request(`/pins?id=eq.${id}`, {
                method: 'DELETE'
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Settings Management
    // ============================================
    async getSettings() {
        try {
            const data = await this.request('/settings?select=*');
            return { success: true, settings: data || [] };
        } catch (error) {
            return { success: false, settings: [], error: error.message };
        }
    }

    async updateSetting(key, value) {
        try {
            const data = await this.request(`/settings?key=eq.${key}`, {
                method: 'PATCH',
                body: JSON.stringify({ value, updated_at: new Date().toISOString() })
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Reports & Statistics
    // ============================================
    async getReportData(startDate, endDate) {
        try {
            let query = '/queue?select=*';
            if (startDate) {
                query += `&entered_at=gte.${startDate}`;
            }
            if (endDate) {
                query += `&entered_at=lte.${endDate}`;
            }
            
            const data = await this.request(query);
            
            // Calculate statistics
            const total = data?.length || 0;
            const completed = data?.filter(q => q.status === 'completed').length || 0;
            const cancelled = data?.filter(q => q.status === 'cancelled').length || 0;
            const waiting = data?.filter(q => q.status === 'waiting').length || 0;

            // Group by clinic
            const byClinic = {};
            data?.forEach(q => {
                if (!byClinic[q.clinic_id]) {
                    byClinic[q.clinic_id] = { total: 0, completed: 0, waiting: 0 };
                }
                byClinic[q.clinic_id].total++;
                if (q.status === 'completed') byClinic[q.clinic_id].completed++;
                if (q.status === 'waiting') byClinic[q.clinic_id].waiting++;
            });

            return {
                success: true,
                summary: { total, completed, cancelled, waiting },
                byClinic,
                rawData: data
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTodayReport() {
        const today = new Date().toISOString().split('T')[0];
        return this.getReportData(`${today}T00:00:00`, `${today}T23:59:59`);
    }
}

// Export singleton instance
export const supabaseDirect = new SupabaseDirectClient();
export default supabaseDirect;
