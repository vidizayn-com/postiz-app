import { Injectable } from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export interface CallbackData {
  integrationId: string;
  name: string;
  provider: string;
  status: 'connected' | 'pending' | 'error';
  picture?: string;
  username?: string;
  error?: string;
}

@Injectable()
export class IntegrationCallbackService {
  
  /**
   * Store callback URL for a given state
   */
  async storeCallbackUrl(state: string, callbackUrl: string): Promise<void> {
    try {
      console.log('IntegrationCallbackService - Storing callback URL:', callbackUrl, 'with state:', state);

      // Store with the primary state
      const result = await ioRedis.set(`callback:${state}`, callbackUrl, 'EX', 300); // 5 minutes expiry
      console.log('IntegrationCallbackService - Redis SET result:', result);

      // For X/Twitter OAuth 1.0a compatibility, also store a mapping from oauth_token to callback
      // This helps when X redirects back with only oauth_token and oauth_verifier
      await ioRedis.set(`callback_mapping:${state}`, callbackUrl, 'EX', 300);
      console.log('IntegrationCallbackService - Also stored callback mapping for X/Twitter compatibility');

      // Verify the storage immediately
      const verification = await ioRedis.get(`callback:${state}`);
      console.log('IntegrationCallbackService - Verification - Retrieved:', verification);

      if (verification !== callbackUrl) {
        throw new Error(`Storage verification failed. Expected: ${callbackUrl}, Got: ${verification}`);
      }
    } catch (error) {
      console.error('IntegrationCallbackService - Error storing callback URL:', error);
      throw error;
    }
  }

  /**
   * Get callback URL for a given state
   * Enhanced to handle X/Twitter OAuth 1.0a flow
   */
  async getCallbackUrl(state: string): Promise<string | null> {
    console.log('IntegrationCallbackService - Looking up callback URL for state:', state);

    // First, try the direct lookup
    let callbackUrl = await ioRedis.get(`callback:${state}`);
    console.log('IntegrationCallbackService - Direct lookup result:', callbackUrl ? 'FOUND' : 'NOT FOUND');

    // If not found, try the mapping (for X/Twitter compatibility)
    if (!callbackUrl) {
      callbackUrl = await ioRedis.get(`callback_mapping:${state}`);
      console.log('IntegrationCallbackService - Mapping lookup result:', callbackUrl ? 'FOUND' : 'NOT FOUND');
    }

    // If still not found, try to find any callback with a similar state pattern
    if (!callbackUrl) {
      console.log('IntegrationCallbackService - Trying pattern-based lookup...');
      const allCallbackKeys = await ioRedis.keys('callback:*');
      const allMappingKeys = await ioRedis.keys('callback_mapping:*');

      console.log('IntegrationCallbackService - Available callback keys:', allCallbackKeys);
      console.log('IntegrationCallbackService - Available mapping keys:', allMappingKeys);

      // Look for keys that contain part of our state (useful for debugging)
      const partialState = state.length > 10 ? state.substring(0, 10) : state;
      const matchingKeys = [...allCallbackKeys, ...allMappingKeys].filter(key =>
        key.includes(partialState)
      );

      if (matchingKeys.length > 0) {
        console.log('IntegrationCallbackService - Found potential matches:', matchingKeys);
        // Try the first match
        const keyToTry = matchingKeys[0];
        callbackUrl = await ioRedis.get(keyToTry);
        console.log('IntegrationCallbackService - Trying key:', keyToTry, 'result:', callbackUrl ? 'FOUND' : 'NOT FOUND');
      }
    }

    return callbackUrl;
  }

  /**
   * Send callback notification to the stored URL
   */
  async sendCallback(state: string, data: CallbackData): Promise<boolean> {
    const callbackUrl = await this.getCallbackUrl(state);

    if (!callbackUrl) {
      return false;
    }

    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Postiz-Integration-Callback/1.0',
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          state,
        }),
      });

      // Clean up the stored callback URL after use
      await ioRedis.del(`callback:${state}`);

      return response.ok;
    } catch (error) {
      console.error('Failed to send callback:', error);
      // Clean up even on error
      await ioRedis.del(`callback:${state}`);
      return false;
    }
  }

  /**
   * Send callback notification without cleaning up the stored URL
   * This allows for both POST notification and redirection
   */
  async sendCallbackNotification(state: string, data: CallbackData): Promise<boolean> {
    const callbackUrl = await this.getCallbackUrl(state);

    if (!callbackUrl) {
      return false;
    }

    try {
      console.log('IntegrationCallbackService - Sending POST notification to:', callbackUrl);

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Postiz-Integration-Callback/1.0',
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          state,
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      console.log('IntegrationCallbackService - POST response status:', response.status);
      return response.ok;
    } catch (error) {
      console.error('IntegrationCallbackService - Failed to send callback notification:', error);

      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error('IntegrationCallbackService - Error name:', error.name);
        console.error('IntegrationCallbackService - Error message:', error.message);
        if ('code' in error) {
          console.error('IntegrationCallbackService - Error code:', (error as any).code);
        }
        if ('syscall' in error) {
          console.error('IntegrationCallbackService - Error syscall:', (error as any).syscall);
        }
      }

      return false;
    }
  }

  /**
   * Clean up callback URL after successful redirection
   */
  async cleanupCallbackUrl(state: string): Promise<void> {
    console.log('IntegrationCallbackService - Cleaning up callback URL for state:', state);

    // Clean up both the direct callback and the mapping
    const deleted1 = await ioRedis.del(`callback:${state}`);
    const deleted2 = await ioRedis.del(`callback_mapping:${state}`);

    console.log('IntegrationCallbackService - Cleanup results - direct:', deleted1, 'mapping:', deleted2);
  }

  /**
   * Clean up expired callback URLs
   */
  async cleanupExpiredCallbacks(): Promise<void> {
    // Redis TTL handles this automatically, but this method can be used for manual cleanup
    const keys = await ioRedis.keys('callback:*');
    for (const key of keys) {
      const ttl = await ioRedis.ttl(key);
      if (ttl === -1) { // No expiry set
        await ioRedis.del(key);
      }
    }
  }
}
