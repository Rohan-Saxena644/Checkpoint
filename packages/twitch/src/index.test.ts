import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { TwitchAdapter, type ChatMessage, type ConnectionStatus } from './index.js';
class FakeSocket extends EventEmitter {
  readyState = 1; closed = false;
  close() { this.readyState = 3; this.closed = true; this.emit('close'); }
  terminate() { this.close(); }
  frame(type: string, payload: unknown, id: string = crypto.randomUUID(), at = new Date().toISOString()) { this.emit('message', Buffer.from(JSON.stringify({ metadata: { message_type: type, message_id: id, message_timestamp: at, subscription_type: 'channel.chat.message' }, payload }))); }
  welcome(id = 'session') { this.frame('session_welcome', { session: { id, keepalive_timeout_seconds: 10 } }); }
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const active: TwitchAdapter[] = [];
afterEach(() => { for (const adapter of active) adapter.stop(); active.length = 0; vi.useRealTimers(); });
function fixture() {
  const sockets: FakeSocket[] = [], urls: string[] = [], inputs: ChatMessage[] = [], statuses: ConnectionStatus[] = [];
  const request = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith('/token')) return new Response(JSON.stringify({ access_token: 'fake-access', refresh_token: 'fake-refresh', expires_in: 14400 }));
    if (String(url).endsWith('/validate')) return new Response(JSON.stringify({ client_id: 'client', user_id: 'broadcaster', login: 'crew', scopes: ['user:read:chat'], expires_in: 14400 }));
    return new Response(JSON.stringify({ data: [] }), { status: 202 });
  });
  const adapter = new TwitchAdapter({ clientId: 'client', clientSecret: 'fake-secret', redirectUri: 'http://localhost:4173/auth/twitch/callback' }, input => inputs.push(input), status => statuses.push(status), request, url => { const socket = new FakeSocket(); sockets.push(socket); urls.push(url); return socket as unknown as WebSocket; }); active.push(adapter);
  const chat = (text = '!route left', overrides = {}) => ({ subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: 'broadcaster', chatter_user_id: 'ada', message: { text }, ...overrides } });
  return { adapter, sockets, urls, inputs, statuses, request, chat };
}
describe('Twitch adapter using synthetic EventSub frames', () => {
  it('requests only user:read:chat and validates before subscribing to version 1', async () => { const f = fixture(); const url = new URL(f.adapter.authorizationUrl('csrf-state')); expect(url.searchParams.get('scope')).toBe('user:read:chat'); expect(url.searchParams.get('state')).toBe('csrf-state'); await f.adapter.authorize('fake-code'); f.sockets[0].welcome(); await settle(); const subscription = f.request.mock.calls.find(([url]) => String(url).includes('/subscriptions'))!; expect(JSON.parse(subscription[1]!.body as string)).toMatchObject({ type: 'channel.chat.message', version: '1', condition: { user_id: 'broadcaster', broadcaster_user_id: 'broadcaster' } }); expect(f.statuses.at(-1)).toBe('connected'); });
  it('deduplicates deliveries and discards stale, foreign/shared-channel and noncommand chat', async () => { const f = fixture(); await f.adapter.authorize('fake'); f.sockets[0].welcome(); await settle(); const socket = f.sockets[0]; socket.frame('notification', f.chat(), 'same'); socket.frame('notification', f.chat(), 'same'); socket.frame('notification', f.chat(), 'stale', new Date(Date.now() - 60000).toISOString()); socket.frame('notification', f.chat('hello')); socket.frame('notification', f.chat('!route left', { broadcaster_user_id: 'other' })); socket.frame('notification', f.chat('!route left', { source_broadcaster_user_id: 'foreign' })); await settle(); expect(f.inputs).toHaveLength(1); expect(f.inputs[0]).toMatchObject({ userId: 'ada', deliveryId: 'same', text: '!route left' }); });
  it('transfers a reconnect session without closing early or resubscribing', async () => { const f = fixture(); await f.adapter.authorize('fake'); const old = f.sockets[0]; old.welcome(); await settle(); old.frame('session_reconnect', { session: { id: 'session', reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=synthetic' } }); await settle(); expect(old.closed).toBe(false); expect(f.urls[1]).toContain('?reconnect=synthetic'); f.sockets[1].welcome('transferred'); await settle(); expect(old.closed).toBe(true); expect(f.request.mock.calls.filter(([url]) => String(url).includes('/subscriptions'))).toHaveLength(1); });
  it('pauses on unexpected loss, resubscribes a new session and handles revocation', async () => { vi.useFakeTimers(); const f = fixture(); await f.adapter.authorize('fake'); f.sockets[0].welcome(); await settle(); f.sockets[0].terminate(); expect(f.statuses.at(-1)).toBe('reconnecting'); await vi.advanceTimersByTimeAsync(1000); f.sockets[1].welcome('fresh'); await settle(); expect(f.request.mock.calls.filter(([url]) => String(url).includes('/subscriptions'))).toHaveLength(2); f.sockets[1].frame('revocation', { subscription: { type: 'channel.chat.message' } }); await settle(); expect(f.statuses.at(-1)).toBe('authorization-required'); expect(f.sockets[1].closed).toBe(true); });
  it('detects missed keepalive and validates authorization hourly', async () => { vi.useFakeTimers(); const f = fixture(); await f.adapter.authorize('fake'); f.sockets[0].welcome(); await settle(); await vi.advanceTimersByTimeAsync(16000); expect(f.statuses).toContain('reconnecting'); await vi.advanceTimersByTimeAsync(55 * 60000); expect(f.request.mock.calls.filter(([url]) => String(url).endsWith('/validate')).length).toBeGreaterThanOrEqual(2); });
});
