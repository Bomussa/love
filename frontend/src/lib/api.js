const API = import.meta.env.VITE_API_URL;

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  return res.json();
}

export function useQueueStream(clinicId, onUpdate) {
  const url = `${API}/queue/stream?clinic_id=${clinicId}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onUpdate(data);
  };

  return () => eventSource.close();
}
