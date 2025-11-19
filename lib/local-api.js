// love/lib/local-api.js
// هذا الملف يوفر واجهة برمجة تطبيقات وهمية (Mock API) للاستخدام في وضع التطوير المحلي.

const localApi = {
    patientLogin: async (patientId, gender) => {
        console.warn("Using Mock API: patientLogin");
        return { success: true, data: { id: `mock-session-${Date.now()}`, patientId, gender } };
    },

    enterQueue: async (clinic, user) => {
        console.warn("Using Mock API: enterQueue");
        return { success: true, position: 1, queueLength: 1, estimatedWait: 5 };
    },

    getQueueStatus: async (clinic) => {
        console.warn("Using Mock API: getQueueStatus for clinic:", clinic);
        return { success: true, queue_stats: { total_waiting: 5, active_clinics: 1 } };
    },

    queueDone: async (clinic, user, pin) => {
        console.warn("Using Mock API: queueDone");
        return { success: true, message: "Mock patient marked as done" };
    },

    callNextPatient: async (clinic) => {
        console.warn("Using Mock API: callNextPatient");
        return { success: true, calledPatient: { id: "mock-patient-123", position: 1 } };
    },

    getPinStatus: async () => {
        console.warn("Using Mock API: getPinStatus");
        return { success: true, pin_available: true, pin_code: "****" };
    },

    choosePath: async (gender) => {
        console.warn("Using Mock API: choosePath");
        return { success: true, path: { id: "mock-path", name: "General" } };
    },

    getAdminStatus: async () => {
        console.warn("Using Mock API: getAdminStatus");
        return { success: true, status: "operational", system_health: { api_status: "healthy" } };
    },

    getQueues: async () => {
        console.warn("Using Mock API: getQueues");
        return { success: true, queues: [{ id: 1, name: "General", currentPatients: 5 }] };
    },

    getDashboardStats: async () => {
        console.warn("Using Mock API: getDashboardStats");
        return { success: true, stats: { totalPatients: 10, activeQueues: 1 } };
    },

    getHealthStatus: async () => {
        console.warn("Using Mock API: getHealthStatus");
        return { success: true, status: "healthy", mode: "local" };
    },

    getClinics: async () => {
        console.warn("Using Mock API: getClinics");
        return { success: true, clinics: [{ id: 1, name: "General Medicine", is_active: true }] };
    }
};

export default localApi;
