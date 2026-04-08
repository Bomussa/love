import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase-client";

export default function DisplayPage() {
  const { clinicId } = useParams();
  const [current, setCurrent] = useState(null);

  const fetchData = async () => {
    const { data } = await supabase
      .from("queues")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    const active =
      data.find((q) => q.status === "called" || q.status === "serving") ||
      data.find((q) => q.status === "waiting");

    setCurrent(active || null);
  };

  useEffect(() => {
    if (!clinicId) return;

    fetchData();

    const channel = supabase
      .channel("queue-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues" },
        fetchData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [clinicId]);

  return (
    <h1>
      {current?.display_number ||
        current?.queue_number_int ||
        current?.queue_number ||
        "--"}
    </h1>
  );
}
