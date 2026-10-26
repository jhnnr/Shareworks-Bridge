import { z } from 'zod';
import { ShareworksPortfolioSchema } from './equity.js';

export const BRIDGE_SOURCE = 'shareworks-bridge' as const;

export const BridgeMessageTypeEnum = z.enum([
  'SW_BRIDGE_PING',
  'SW_BRIDGE_PONG',
  'SW_START_SYNC',
  'SW_CLEAR_CACHE',
  'SW_AUTH_REQUIRED',
  'SW_DATA_READY',
  'SW_ERROR',
]);
export type BridgeMessageType = z.infer<typeof BridgeMessageTypeEnum>;

export const PingMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE).optional(),
  type: z.literal('SW_BRIDGE_PING'),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const PongPayloadSchema = z.object({
  version: z.string().min(1),
  ready: z.boolean(),
  activeTabDetected: z.boolean(),
});
export type PongPayload = z.infer<typeof PongPayloadSchema>;

export const PongMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE),
  type: z.literal('SW_BRIDGE_PONG'),
  payload: PongPayloadSchema,
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

export const StartSyncMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE).optional(),
  type: z.literal('SW_START_SYNC'),
});
export type StartSyncMessage = z.infer<typeof StartSyncMessageSchema>;

export const ClearCacheMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE).optional(),
  type: z.literal('SW_CLEAR_CACHE'),
});
export type ClearCacheMessage = z.infer<typeof ClearCacheMessageSchema>;

export const AuthRequiredPayloadSchema = z.object({
  message: z.string().optional(),
  loginUrl: z.string().optional(),
});
export type AuthRequiredPayload = z.infer<typeof AuthRequiredPayloadSchema>;

export const AuthRequiredMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE),
  type: z.literal('SW_AUTH_REQUIRED'),
  payload: AuthRequiredPayloadSchema.optional(),
});
export type AuthRequiredMessage = z.infer<typeof AuthRequiredMessageSchema>;

export const DataReadyPayloadSchema = ShareworksPortfolioSchema;
export type DataReadyPayload = z.infer<typeof DataReadyPayloadSchema>;

export const DataReadyMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE),
  type: z.literal('SW_DATA_READY'),
  payload: DataReadyPayloadSchema,
});
export type DataReadyMessage = z.infer<typeof DataReadyMessageSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export const ErrorMessageSchema = z.object({
  source: z.literal(BRIDGE_SOURCE),
  type: z.literal('SW_ERROR'),
  payload: ErrorPayloadSchema,
});
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export const BridgeMessageSchema = z.discriminatedUnion('type', [
  PingMessageSchema,
  PongMessageSchema,
  StartSyncMessageSchema,
  ClearCacheMessageSchema,
  AuthRequiredMessageSchema,
  DataReadyMessageSchema,
  ErrorMessageSchema,
]);
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;
