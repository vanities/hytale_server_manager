import { io, Socket } from 'socket.io-client';

const WS_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class WebSocketService {
  private baseUrl: string;
  private serversSocket: Socket | null = null;
  private consoleSocket: Socket | null = null;

  constructor(baseUrl: string = WS_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ============================================
  // Server Events (/servers namespace)
  // ============================================

  connectToServers() {
    if (this.serversSocket?.connected) {
      return this.serversSocket;
    }

    this.serversSocket = io(`${this.baseUrl}/servers`, {
      transports: ['websocket', 'polling'],
    });

    this.serversSocket.on('connect', () => {});

    this.serversSocket.on('disconnect', () => {});

    this.serversSocket.on('error', (error) => {
      console.error('WebSocket error (/servers):', error);
    });

    return this.serversSocket;
  }

  subscribeToServer(serverId: string, callbacks: {
    onStatus?: (data: any) => void;
    onMetrics?: (data: any) => void;
  }) {
    const socket = this.connectToServers();

    // Subscribe to server updates
    socket.emit('subscribe', { serverId });

    // Set up event listeners
    if (callbacks.onStatus) {
      socket.on('server:status', (data) => {
        if (data.serverId === serverId) {
          callbacks.onStatus?.(data);
        }
      });
    }

    if (callbacks.onMetrics) {
      socket.on('server:metrics', (data) => {
        if (data.serverId === serverId) {
          callbacks.onMetrics?.(data);
        }
      });
    }

    return () => {
      socket.emit('unsubscribe', { serverId });
    };
  }

  disconnectFromServers() {
    if (this.serversSocket) {
      this.serversSocket.disconnect();
      this.serversSocket = null;
    }
  }

  // ============================================
  // Console Events (/console namespace)
  // ============================================

  connectToConsole() {
    if (this.consoleSocket?.connected) {
      return this.consoleSocket;
    }

    this.consoleSocket = io(`${this.baseUrl}/console`, {
      transports: ['websocket', 'polling'],
    });

    this.consoleSocket.on('connect', () => {});

    this.consoleSocket.on('disconnect', () => {});

    this.consoleSocket.on('error', (error) => {
      console.error('WebSocket error (/console):', error);
    });

    return this.consoleSocket;
  }

  subscribeToConsole(serverId: string, callbacks: {
    onLog?: (data: any) => void;
    onHistoricalLogs?: (data: any) => void;
    onCommandResponse?: (data: any) => void;
  }) {
    const socket = this.connectToConsole();

    // Subscribe to console logs
    socket.emit('subscribe', { serverId });

    // Set up event listeners
    if (callbacks.onLog) {
      socket.on('log', (data) => {
        if (data.serverId === serverId) {
          callbacks.onLog?.(data);
        }
      });
    }

    if (callbacks.onHistoricalLogs) {
      socket.on('logs:history', (data) => {
        if (data.serverId === serverId) {
          callbacks.onHistoricalLogs?.(data);
        }
      });
    }

    if (callbacks.onCommandResponse) {
      socket.on('commandResponse', (data) => {
        if (data.serverId === serverId) {
          callbacks.onCommandResponse?.(data);
        }
      });
    }

    return () => {
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
