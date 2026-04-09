import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase-client";

/**
 * Display Page - v2.1
 * Unified data source on 'queues' table.
 */
export function DisplayPage() {
  const { clinicId } = useParams();
  const [current, setCurrent] = useState(null);

  const fetchData = async () => {
    if (!clinicId) return;
    
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("queues")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("queue_date", today)
      .order("display_number", { ascending: true });

    if (error || !data) return;

    // البحث عن المراجع المستدعى حالياً أو الذي يتم خدمته
    const active =
      data.find((q) => ["called", "CALLED", "serving", "SERVING"].includes(q.status)) ||
      data.find((q) => ["waiting", "WAITING"].includes(q.status));

    setCurrent(active || null);
  };

  useEffect(() => {
    if (!clinicId) return;

    fetchData();

    const channel = supabase
      .channel(`display_updates_${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues", filter: `clinic_id=eq.${clinicId}` },
        fetchData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [clinicId]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-[20rem] font-bold">
        {current?.display_number || "--"}
      </h1>
    </div>
  );
}

export default DisplayPage;
