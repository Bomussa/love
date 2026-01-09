import React, { useEffect, useState } from "react";
import "./AdminPage.css";

export function AdminPage() {
  const [stats, setStats] = useState(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const statsRes = await fetch("/api/v1/admin/stats");
        const pinsRes = await fetch("/api/v1/admin/pins");

        const statsData = await statsRes.json();
        const pinsData = await pinsRes.json();

        if (mounted) {
          setStats(statsData);
          setPins(pinsData);
        }
      } catch (e) {
        console.error("AdminPage load error", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">Loading…</div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      {/* HEADER */}
      <section className="admin-header">
        <h1>لوحة الإدارة</h1>
      </section>

      {/* STATS */}
      <section className="admin-stats">
        <div className="stat-card">
          <span className="stat-label">بانتظار</span>
          <span className="stat-value">{stats?.waiting ?? 0}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">يتم خدمتهم</span>
          <span className="stat-value">{stats?.serving ?? 0}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">مكتمل</span>
          <span className="stat-value">{stats?.completed ?? 0}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">متجاوز</span>
          <span className="stat-value">{stats?.skipped ?? 0}</span>
        </div>
      </section>

      {/* PIN MONITOR */}
      <section className="admin-pins">
        <h2>مراقبة PIN</h2>

        {pins.length === 0 && (
          <div className="empty-state">لا توجد بيانات</div>
        )}

        {pins.map((pin) => (
          <div key={pin.id} className="pin-row">
            <span className="pin-code">{pin.code}</span>
            <span className="pin-status">{pin.status}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
