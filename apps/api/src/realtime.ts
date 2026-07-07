// Minimal in-process pub-sub for pushing live updates to open browser tabs via
// Server-Sent Events. Single-process scope (fine for this app's one Railway
// instance) — if this ever runs multi-instance, swap the EventEmitter here
// for a Redis pub/sub channel; nothing above this module needs to change.

import { EventEmitter } from 'events';

export type InboxEvent =
  | { type: 'message'; data: any }   // a Message row (mapMessage shape) was created or updated
  | { type: 'ping' };

const bus = new EventEmitter();
bus.setMaxListeners(0); // unbounded — one listener per open Inbox tab

const CHANNEL = 'inbox';

export function publishInboxEvent(event: InboxEvent): void {
  bus.emit(CHANNEL, event);
}

/** Subscribe to inbox events; returns an unsubscribe function. */
export function subscribeInboxEvents(handler: (event: InboxEvent) => void): () => void {
  bus.on(CHANNEL, handler);
  return () => bus.off(CHANNEL, handler);
}
