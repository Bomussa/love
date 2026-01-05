// love/lib/request.js
// وظيفة مساعدة موحدة للتعامل مع طلبات Fetch
// تضمن معالجة الأخطاء وتحويل JSON

const API_VERSION = '/api/v1';

export async function request(endpoint, options = {}) {
    const url = `${window.location.origin}${endpoint.startsWith(API_VERSION) ? endpoint : API_VERSION + endpoint}`;
    
    const config = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (options.body && typeof options.body !== 'string') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            // إرجاع رسالة خطأ مفصلة
            const errorMessage = data?.error || data?.message || `HTTP Error: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        return data;
    } catch (err) {
        console.error('API Request Error:', err);
        throw err;
    }
}
