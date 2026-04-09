import supabase from "./supabase-client";
import { localDateKeyAsiaQatar } from "../utils/time";

/**
 * Statistics Engine - v2.1
 * Unified data source on 'queues' table with Asia/Qatar timezone support.
 */

export async function getStats(clinicId) {
  try {
    const today = localDateKeyAsiaQatar();
    
    const { data, error } = await supabase
      .from("queues")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("queue_date", today);

    if (error) throw error;

    const waiting = data.filter((d) => d.status === "waiting" || d.status === "WAITING");
    const serving = data.filter((d) => ["called", "CALLED", "serving", "SERVING"].includes(d.status));
    const completed = data.filter((d) => ["completed", "COMPLETED", "done", "DONE"].includes(d.status));

    return {
      total: data.length,
      waiting: waiting.length,
      serving: serving.length,
      completed: completed.length,
      dateKey: today
    };
  } catch (error) {
    // console.error("Statistics Engine Error:", error);
    return {
      total: 0,
      waiting: 0,
      serving: 0,
      completed: 0,
      dateKey: new Date().toISOString().split('T')[0]
    };
  }
}
