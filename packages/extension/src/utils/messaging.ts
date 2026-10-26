import {
  BridgeMessageSchema,
  type BridgeMessage,
  BRIDGE_SOURCE,
} from '../types/messages.js';

// Approved origins for dashboard communication
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/localhost(:\d+)?$/,
  /^https:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.github\.io$/,
];

/**
 * Validates whether the incoming event origin is allowed.
 * Must match current window origin or the configured local dashboard origins.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return true;
  }
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Dispatches a postMessage to a target window with strict origin validation.
 * Disallows wildcard '*' origins when financial or bridge messages are transmitted.
 */
export function sendSecurePostMessage(
  targetWindow: Window,
  targetOrigin: string,
  message: BridgeMessage
): void {
  if (!targetOrigin || targetOrigin === '*') {
    throw new Error('Security Violation: Wildcard (*) target origin is prohibited for financial bridge messages.');
  }
  if (!isAllowedOrigin(targetOrigin)) {
    throw new Error(`Security Violation: Target origin '${targetOrigin}' is not whitelisted.`);
  }

  // Ensure source tag is attached
  const payloadWithSource = {
    ...message,
    source: BRIDGE_SOURCE,
  };

  targetWindow.postMessage(payloadWithSource, targetOrigin);
}

/**
 * Parses and validates an inbound window message event.
 * Rejects events from unverified origins or with invalid schemas without throwing.
 */
export function parseInboundMessage(event: MessageEvent): BridgeMessage | null {
  // 1. Strict Origin check
  if (!isAllowedOrigin(event.origin)) {
    return null;
  }

  // 2. Ignore non-object data
  if (!event.data || typeof event.data !== 'object') {
    return null;
  }

  // 3. Schema validation
  const result = BridgeMessageSchema.safeParse(event.data);
  if (!result.success) {
    return null;
  }

  return result.data;
}
