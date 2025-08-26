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
    await ioRedis.set(`callback:${state}`, callbackUrl, 'EX', 300); // 5 minutes expiry
  }

  /**
   * Get callback URL for a given state
   */
  async getCallbackUrl(state: string): Promise<string | null> {
    return await ioRedis.get(`callback:${state}`);
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
