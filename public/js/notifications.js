(() => {
    try {
        const src = '/api/events';
        const es = new EventSource(src);
        es.addEventListener('notification', (e) => {
            try {
                const n = JSON.parse(e.data);
                const ttl = Number(n.ttl || 30000);
                const el = document.createElement('div');
                el.className = `notif notif-${(n.type || 'info').toLowerCase()}`;
                el.style.cssText = 'position:fixed;inset-inline-end:12px;bottom:12px;background:#111;color:#fff;padding:10px 12px;border-radius:8px;z-index:99999;max-width:320px;box-shadow:0 6px 18px rgba(0,0,0,.25);font-family:system-ui';
                el.innerHTML = `<strong>${n.title || ''}</strong><div>${n.message || ''}</div>`;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), ttl);
            } catch { }
        });
    } catch { }
})();
