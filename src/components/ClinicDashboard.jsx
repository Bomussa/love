import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api-unified";

export default function ClinicDashboard() {
  const { clinicId } = useParams();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});

  const fetchQueue = async () => {
    const data = await api.getQueueStatus(clinicId);
    setQueue(data);
  };

  const fetchStats = async () => {
    const response = await fetch(`/api/v1/queue/stats?clinicId=${clinicId}`);
    const data = await response.json();
    setStats(data);
  };

  useEffect(() => {
    if (!clinicId) return;
    fetchQueue();
    fetchStats();
    const interval = setInterval(() => {
      fetchQueue();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [clinicId]);

  return (
    <div>
      <h2>Queue Dashboard</h2>
      <p>Total: {stats.total}</p>
      <p>Waiting: {stats.waiting}</p>
      <p>Serving: {stats.serving}</p>
      <p>Completed: {stats.completed}</p>
      <ul>
        {queue.map((q) => (
          <li key={q.id}>{q.display_number} - {q.status}</li>
        ))}
      </ul>
    </div>
  );
}
export default ClinicDashboard
