import { io, Socket } from 'socket.io-client';
import { authService } from './auth';

const WS_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ConsoleSubscription {
  serverId: string;
  callbacks: {
    onLog?: (data: any) => void;
    onHistoricalLogs?: (data: any) => void;
    onCommandResponse?: (data: any) => void;
  };
}

interface ServerSubscription {
  serverId: string;
  callbacks: {
    onStatus?: (data: any) => void;
    onMetrics?: (data: any) => void;
  };
}

class WebSocketService {
  private baseUrl: string;
  private serversSocket: Socket | null = null;
  private consoleSocket: Socket | null = null;
  private isRefreshing = false;

  // Track active subscriptions for re-subscribing after reconnection
  private consoleSubscriptions: Map<string, ConsoleSubscription> = new Map();
  private serverSubscriptions: Map<string, ServerSubscription> = new Map();

  constructor(baseUrl: string = WS_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Refresh the auth token and update it in localStorage
   */
  private async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      // Wait a bit and check if token is available
      await new Promise(resolve => setTimeout(resolve, 1000));
      return localStorage.getItem('accessToken');
    }

    this.isRefreshing = true;
    try {
      console.log('[WebSocket] Refreshing auth token...');
      await authService.refreshAccessToken();
      const token = localStorage.getItem('accessToken');
      console.log('[WebSocket] Token refreshed:', token ? 'success' : 'failed');
      return token;
    } catch (error) {
      console.error('[WebSocket] Token refresh failed:', error);
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  // ============================================
  // Server Events (/servers namespace)
  // ============================================

  connectToServers() {
    if (this.serversSocket?.connected) {
      return this.serversSocket;
    }

    // Disconnect existing socket if any
    if (this.serversSocket) {
      this.serversSocket.removeAllListeners();
      this.serversSocket.disconnect();
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('accessToken');

    this.serversSocket = io(`${this.baseUrl}/servers`, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    this.serversSocket.on('connect', () => {
      console.log('[WebSocket] Connected to /servers');
      // Re-subscribe to all active server subscriptions
      this.resubscribeToServers();
    });

    this.serversSocket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from /servers');
    });

    this.serversSocket.on('connect_error', async (error) => {
      console.error('[WebSocket] Connection error (/servers):', error.message);

      // If auth error, try to refresh token and reconnect
      if (error.message === 'Invalid token' || error.message === 'Token expired' || error.message === 'Authentication required') {
        console.log('[WebSocket] Auth error on /servers, attempting token refresh...');
        const newToken = await this.refreshToken();
        if (newToken) {
          // Reconnect with fresh token
          this.serversSocket?.disconnect();
          this.serversSocket = null;
          this.connectToServers();
        }
      }
    });

    this.serversSocket.on('error', (error) => {
      console.error('WebSocket error (/servers):', error);
    });

    // Set up event listeners for server updates
    this.setupServerEventListeners();

    return this.serversSocket;
  }

  private setupServerEventListeners() {
    if (!this.serversSocket) return;

    this.serversSocket.on('server:status', (data) => {
      const sub = this.serverSubscriptions.get(data.serverId);
      if (sub?.callbacks.onStatus) {
        sub.callbacks.onStatus(data);
      }
    });

    this.serversSocket.on('server:metrics', (data) => {
      const sub = this.serverSubscriptions.get(data.serverId);
      if (sub?.callbacks.onMetrics) {
        sub.callbacks.onMetrics(data);
      }
    });
  }

  private resubscribeToServers() {
    if (!this.serversSocket?.connected) return;

    for (const [serverId] of this.serverSubscriptions) {
      console.log('[WebSocket] Re-subscribing to server:', serverId);
      this.serversSocket.emit('subscribe', { serverId });
    }
  }

  subscribeToServer(serverId: string, callbacks: {
    onStatus?: (data: any) => void;
    onMetrics?: (data: any) => void;
  }) {
    // Store subscription for reconnection
    this.serverSubscriptions.set(serverId, { serverId, callbacks });

    const socket = this.connectToServers();

    // Subscribe when connected (or immediately if already connected)
    if (socket.connected) {
      socket.emit('subscribe', { serverId });
    }
    // If not connected, the 'connect' handler will re-subscribe

    return () => {
      this.serverSubscriptions.delete(serverId);
      socket.emit('unsubscribe', { serverId });
    };
  }

  disconnectFromServers() {
    if (this.serversSocket) {
      this.serversSocket.disconnect();
      this.serversSocket = null;
    }
    this.serverSubscriptions.clear();
  }

  // ============================================
  // Console Events (/console namespace)
  // ============================================

  connectToConsole() {
    if (this.consoleSocket?.connected) {
      return this.consoleSocket;
    }

    // Disconnect existing socket if any
    if (this.consoleSocket) {
      this.consoleSocket.removeAllListeners();
      this.consoleSocket.disconnect();
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('accessToken');

    this.consoleSocket = io(`${this.baseUrl}/console`, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    this.consoleSocket.on('connect', () => {
      console.log('[WebSocket] Connected to /console');
      // Re-subscribe to all active console subscriptions
      this.resubscribeToConsoles();
    });

    this.consoleSocket.on('connect_error', async (error) => {
      console.error('[WebSocket] Connection error (/console):', error.message);

      // If auth error, try to refresh token and reconnect
      if (error.message === 'Invalid token' || error.message === 'Token expired' || error.message === 'Authentication required') {
        console.log('[WebSocket] Auth error on /console, attempting token refresh...');
        const newToken = await this.refreshToken();
        if (newToken) {
          // Reconnect with fresh token
          this.consoleSocket?.disconnect();
          this.consoleSocket = null;
          this.connectToConsole();
        }
      }
    });

    this.consoleSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected from /console:', reason);
    });

    this.consoleSocket.on('error', (error) => {
      console.error('[WebSocket] Error (/console):', error);
    });

    // Set up event listeners for console updates
    this.setupConsoleEventListeners();

    return this.consoleSocket;
  }

  private setupConsoleEventListeners() {
    if (!this.consoleSocket) return;

    this.consoleSocket.on('log', (data) => {
      const sub = this.consoleSubscriptions.get(data.serverId);
      if (sub?.callbacks.onLog) {
        sub.callbacks.onLog(data);
      }
    });

    this.consoleSocket.on('logs:history', (data) => {
      const sub = this.consoleSubscriptions.get(data.serverId);
      if (sub?.callbacks.onHistoricalLogs) {
        sub.callbacks.onHistoricalLogs(data);
      }
    });

    this.consoleSocket.on('commandResponse', (data) => {
      const sub = this.consoleSubscriptions.get(data.serverId);
      if (sub?.callbacks.onCommandResponse) {
        sub.callbacks.onCommandResponse(data);
      }
    });
  }

  private resubscribeToConsoles() {
    if (!this.consoleSocket?.connected) return;

    for (const [serverId] of this.consoleSubscriptions) {
      console.log('[WebSocket] Re-subscribing to console for server:', serverId);
      this.consoleSocket.emit('subscribe', { serverId });
    }
  }

  subscribeToConsole(serverId: string, callbacks: {
    onLog?: (data: any) => void;
    onHistoricalLogs?: (data: any) => void;
    onCommandResponse?: (data: any) => void;
  }) {
    // Store subscription for reconnection
    this.consoleSubscriptions.set(serverId, { serverId, callbacks });

    const socket = this.connectToConsole();

    // Subscribe when connected (or immediately if already connected)
    if (socket.connected) {
      console.log('[WebSocket] Subscribing to console for server:', serverId);
      socket.emit('subscribe', { serverId });
    }
    // If not connected, the 'connect' handler will re-subscribe

    return () => {
      this.consoleSubscriptions.delete(serverId);
      socket.emit('unsubscribe', { serverId });
    };
  }

  sendCommand(serverId: string, command: string) {
    const socket = this.connectToConsole();
    socket.emit('command', { serverId, command });
  }

  disconnectFromConsole() {
    if (this.consoleSocket) {
      this.consoleSocket.disconnect();
      this.consoleSocket = null;
    }
    this.consoleSubscriptions.clear();
  }

  // ============================================
  // Cleanup
  // ============================================

  disconnectAll() {
    this.disconnectFromServers();
    this.disconnectFromConsole();
  }
}

export const websocket = new WebSocketService();
export default websocket;
