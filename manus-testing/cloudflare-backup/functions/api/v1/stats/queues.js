// All Queues Stats - Get status of all queues
// Returns list of all queues with their current status

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const kv = env.KV_QUEUES;
    
    // List of all clinics with names
    const clinics = [
      { id: 'lab', name: 'المختبر' },
      { id: 'xray', name: 'الأشعة' },
      { id: 'eyes', name: 'العيون' },
      { id: 'internal', name: 'الباطنية' },
      { id: 'ent', name: 'الأنف والأذن والحنجرة' },
      { id: 'surgery', name: 'الجراحة' },
      { id: 'dental', name: 'الأسنان' },
      { id: 'psychiatry', name: 'الطب النفسي' },
      { id: 'derma', name: 'الجلدية' },
      { id: 'bones', name: 'العظام' },
      { id: 'vitals', name: 'القياسات الحيوية' },
      { id: 'ecg', name: 'تخطيط القلب' },
      { id: 'audio', name: 'السمعيات' },
      { id: 'women_internal', name: 'الباطنية (نساء)' },
      { id: 'women_derma', name: 'الجلدية (نساء)' },
      { id: 'women_eyes', name: 'العيون (نساء)' }
    ];
    
    const queues = [];
    
    // Get stats for each clinic
    for (const clinic of clinics) {
      const queueKey = `queue:list:${clinic.id}`;
      const queueData = await kv.get(queueKey, { type: 'json' });
      
      if (!queueData || !Array.isArray(queueData) || queueData.length === 0) {
        // No data for this clinic today
        queues.push({
          clinic: clinic.id,
          name: clinic.name,
          current: null,
          current_display: 0,
          total: 0,
          waiting: 0,
          completed: 0,
          active: false
        });
        continue;
      }
      
      // Count by status
      const waiting = queueData.filter(item => item.status === 'WAITING').length;
      const inService = queueData.filter(item => item.status === 'IN_SERVICE').length;
      const completed = queueData.filter(item => item.status === 'DONE' || item.status === 'COMPLETED').length;
      const total = queueData.length;
      
      // Get current patient (first in waiting or in service)
      const currentPatient = queueData.find(item => item.status === 'IN_SERVICE') || 
                            (waiting > 0 ? queueData.find(item => item.status === 'WAITING') : null);
      
      queues.push({
        clinic: clinic.id,
        name: clinic.name,
        current: currentPatient ? currentPatient.number : null,
        current_display: currentPatient ? currentPatient.number : 0,
        total: total,
        waiting: waiting,
        completed: completed,
        active: total > 0
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      queues: queues,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

