import { createEnv } from '../lib/storage.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { user, clinic } = req.query;

  if (!user && !clinic) {
    return res.status(400).json({
      success: false,
      error: 'user or clinic parameter required'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'CONNECTED',
    user,
    clinic,
    timestamp: new Date().toISOString()
  })}\n\n`);

  const env = createEnv();
  
  // Poll for updates every 5 seconds
  const intervalId = setInterval(async () => {
    try {
      if (user) {
        // Get user's queue position
        const userQueues = await env.KV_QUEUES.list({ prefix: `queue:user:` });
        
        for (const key of userQueues.keys) {
          if (key.name.includes(user)) {
            const userData = await env.KV_QUEUES.get(key.name, { type: 'json' });
            
            if (userData && userData.clinic) {
              const queueKey = `queue:list:${userData.clinic}`;
              const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
              
              const userIndex = queueData.findIndex(e => e.user === user);
              const position = userIndex + 1;
              
              // Send notification at position 3, 2, 1
              if (position === 3 || position === 2 || position === 1) {
                const notification = {
                  type: 'queue_update',
                  position,
                  clinic: userData.clinic,
                  message: position === 1 ? 'دورك الآن!' : position === 2 ? 'أنت الثاني - كن جاهزاً' : 'أنت الثالث - استعد',
                  messageEn: position === 1 ? 'Your turn now!' : position === 2 ? 'You are second - be ready' : 'You are third - get ready',
                  playSound: position === 1,
                  timestamp: new Date().toISOString()
                };
                
                res.write(`event: queue_update\ndata: ${JSON.stringify(notification)}\n\n`);
              }
            }
          }
        }
      }
      
      if (clinic) {
        // Get clinic queue status
        const queueKey = `queue:list:${clinic}`;
        const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
        
        const statusKey = `queue:status:${clinic}`;
        const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {};
        
        const update = {
          type: 'clinic_update',
          clinic,
          waiting: queueData.length,
          current: status.current,
          timestamp: new Date().toISOString()
        };
        
        res.write(`event: clinic_update\ndata: ${JSON.stringify(update)}\n\n`);
      }
      
      // Send heartbeat
      res.write(`: heartbeat\n\n`);
      
    } catch (error) {
      console.error('SSE error:', error);
    }
  }, 5000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
}

