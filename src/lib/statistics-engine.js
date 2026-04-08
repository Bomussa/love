import supabase from "./supabase-client";

function getQatarRange() {
  const now = new Date();
  const start = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Qatar" })
  );
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getStats(clinicId) {
  const { start, end } = getQatarRange();
  const { data } = await supabase
    .from("queues")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  return {
    total: data.length,
    waiting: data.filter((d) => d.status === "waiting").length,
    serving: data.filter((d) => d.status === "serving").length,
    completed: data.filter((d) => d.status === "completed").length,
  };
}
