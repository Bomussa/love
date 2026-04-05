import test from 'node:test';
import assert from 'node:assert/strict';
import eventBus from '../src/core/event-bus.js';

test('eventBus emits and unsubscribes listeners', () => {
  let seen = null;
  const off = eventBus.on('queue:your_turn', (payload) => {
    seen = payload;
  });

  eventBus.emit('queue:your_turn', { type: 'YOUR_TURN' });
  assert.deepEqual(seen, { type: 'YOUR_TURN' });

  off();
  seen = null;
  eventBus.emit('queue:your_turn', { type: 'YOUR_TURN' });
  assert.equal(seen, null);
});
