// SSE endpoint for real-time notifications
// Cloudflare Pages Functions format
// Updated to work with unified queue structure

export const onRequestGet = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const clinic = url.searchParams.get('clinic');
  const user = url.searchParams.get('user');
  
  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Function to send SSE events
  const sendEvent = (eventName, data) => {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.ready.then(() => {
      writer.write(encoder.encode(payload)).catch(() => {});
    });
  };

  // Send initial connection event
  sendEvent('connected', { status: 'ok', timestamp: Date.now(), clinic, user });

  // Track last position to detect changes
  let lastPosition = null;
  let lastNotificationType = null;

  // Function to check queue and send notifications
  const checkQueueAndNotify = async () => {
    if (!clinic || !user) return;
    
    try {
      // Get queue data from current structure
      const kv = env?.KV_QUEUES;
      if (!kv) return;

      const listKey = `queue:list:${clinic}`;
      const userKey = `queue:user:${clinic}:${user}`;
      const currentKey = `queue:current:${clinic}`;
      
      // Get queue list, user entry, and current patient
      const queueList = await kv.get(listKey, { type: 'json' }) || [];
      const userEntry = await kv.get(userKey, { type: 'json' });
      const currentData = await kv.get(currentKey, { type: 'json' });
      
      if (!userEntry) return;
      
      // Check if user is done
      if (userEntry.status === 'DONE') {
        sendEvent('queue_update', {
          type: 'COMPLETED',
          clinic,
          user,
          message: '✅ تم الانتهاء من الفحص',
          messageEn: '✅ Examination completed',
          timestamp: Date.now()
        });
        return;
      }
      
      const userNumber = userEntry.number;
      
      // Get only WAITING patients
      const waitingPatients = queueList.filter(item => item.status === 'WAITING');
      
      // Sort by entry time to ensure correct order
      waitingPatients.sort((a, b) => {
        const timeA = new Date(a.entered_at).getTime();
        const timeB = new Date(b.entered_at).getTime();
        return timeA - timeB;
      });
      
      // Find user position in waiting list
      const myIndex = waitingPatients.findIndex(item => item.user === user);
      
      if (myIndex === -1) {
        // User not in waiting list - might be in service or done
        if (userEntry.status === 'IN_SERVICE') {
          sendEvent('queue_update', {
            type: 'IN_SERVICE',
            clinic,
            user,
            number: userNumber,
            message: '🏥 أنت الآن داخل العيادة',
            messageEn: '🏥 You are now in the clinic',
            timestamp: Date.now()
          });
        }
        return;
      }
      
      const position = myIndex + 1; // 1-based position
      const ahead = myIndex; // 0-based ahead count
      const totalWaiting = waitingPatients.length;
      
      // Determine notification type based on position
      let notificationType = null;
      let shouldNotify = false;
      
      if (ahead === 0) {
        // User is first in line - YOUR TURN
        notificationType = 'YOUR_TURN';
        shouldNotify = lastNotificationType !== 'YOUR_TURN';
      } else if (ahead === 1) {
        // User is second in line - NEXT
        notificationType = 'NEXT_IN_LINE';
        shouldNotify = lastNotificationType !== 'NEXT_IN_LINE';
      } else if (ahead === 2) {
        // User is third in line
        notificationType = 'NEAR_TURN';
        shouldNotify = lastNotificationType !== 'NEAR_TURN';
      } else if (ahead === 3) {
        // User is fourth in line
        notificationType = 'ALMOST_READY';
        shouldNotify = lastNotificationType !== 'ALMOST_READY';
      } else if (position !== lastPosition) {
        // Position changed
        notificationType = 'POSITION_UPDATE';
        shouldNotify = true;
      }
      
      // Send notification if needed
      if (shouldNotify && notificationType) {
        let message = '';
        let messageEn = '';
        
        switch (notificationType) {
          case 'YOUR_TURN':
            message = '🔔 حان دورك الآن! توجه إلى العيادة';
            messageEn = '🔔 Your turn now! Go to the clinic';
            break;
          case 'NEXT_IN_LINE':
            message = '⏰ أنت التالي - استعد من فضلك';
            messageEn = '⏰ You are next - Please get ready';
            break;
          case 'NEAR_TURN':
            message = '⏰ اقترب دورك - أنت الثالث';
            messageEn = '⏰ Near your turn - You are third';
            break;
          case 'ALMOST_READY':
            message = '📋 استعد - أنت الرابع';
            messageEn = '📋 Get ready - You are fourth';
            break;
          case 'POSITION_UPDATE':
            message = `📊 موقعك: ${position} من ${totalWaiting}`;
            messageEn = `📊 Position: ${position} of ${totalWaiting}`;
            break;
        }
        
        sendEvent('queue_update', {
          type: notificationType,
          clinic,
          user,
          position,
          ahead,
          total: totalWaiting,
          number: userNumber,
          current: currentData ? currentData.number : null,
          message,
          messageEn,
          timestamp: Date.now()
        });
        
        lastNotificationType = notificationType;
        lastPosition = position;
      }
      
    } catch (error) {
      console.error('Error checking queue:', error);
    }
  };

  // Check queue immediately
  checkQueueAndNotify();

  // Check queue every 2 seconds for real-time updates
  const queueCheckInterval = setInterval(checkQueueAndNotify, 2000);

  // Send heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    sendEvent('heartbeat', { ts: Date.now(), type: 'heartbeat' });
  }, 15000);

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    clearInterval(queueCheckInterval);
    writer.close().catch(() => {});
  });

  // Return SSE response
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    }
  });
};

