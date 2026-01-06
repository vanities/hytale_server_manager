import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chokidar, { FSWatcher } from 'chokidar';
import { LogEntry } from '../types';
import logger from '../utils/logger';

interface TailState {
  serverId: string;
  logPath: string;
  watcher: FSWatcher;
  filePosition: number;
  callback: (log: LogEntry) => void;
  isActive: boolean;
}

/**
 * Service for tailing server log files.
 * Used to capture console output after reconnecting to a running server.
 */
export class LogTailService {
  private tailStates: Map<string, TailState> = new Map();

  /**
   * Start tailing a log file
   */
  async startTailing(
    serverId: string,
    logPath: string,
    onLog: (log: LogEntry) => void
  ): Promise<void> {
    // Stop existing tail if any
    await this.stopTailing(serverId);

    // Verify log file exists
    if (!fs.existsSync(logPath)) {
      logger.warn(`[LogTail] Log file not found: ${logPath}, will watch for creation`);
    }

    // Get initial file position (start from end of file)
    let filePosition = 0;
    try {
      const stats = fs.statSync(logPath);
      filePosition = stats.size;
    } catch {
      // File doesn't exist yet, start from 0
    }

    const state: TailState = {
      serverId,
      logPath,
      watcher: null as any,
      filePosition,
      callback: onLog,
      isActive: true,
    };

    // Watch the log file
    const watcher = chokidar.watch(logPath, {
      persistent: true,
      usePolling: true,       // More reliable for files being written to
      interval: 100,          // Poll every 100ms
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    state.watcher = watcher;

    // Handle file changes
    watcher.on('change', async () => {
      if (!state.isActive) return;
      await this.readNewLines(state);
    });

    // Handle file creation (in case it didn't exist)
    watcher.on('add', async (filePath) => {
      if (!state.isActive) return;
      logger.info(`[LogTail] Log file created: ${filePath}`);
      state.filePosition = 0;
      await this.readNewLines(state);
    });

    // Handle log rotation (file replaced)
    watcher.on('unlink', (filePath) => {
      logger.info(`[LogTail] Log file removed (rotation?): ${filePath}`);
      state.filePosition = 0;
    });

    watcher.on('error', (error) => {
      logger.error(`[LogTail] Watcher error for ${serverId}:`, error);
    });

    this.tailStates.set(serverId, state);
    logger.info(`[LogTail] Started tailing ${logPath} for server ${serverId}`);

    // Read any existing content from current position
    await this.readNewLines(state);
  }

  /**
   * Stop tailing a log file
   */
  async stopTailing(serverId: string): Promise<void> {
    const state = this.tailStates.get(serverId);
    if (state) {
      state.isActive = false;
      await state.watcher.close();
      this.tailStates.delete(serverId);
      logger.info(`[LogTail] Stopped tailing for server ${serverId}`);
    }
  }

  /**
   * Check if tailing is active for a server
   */
  isTailing(serverId: string): boolean {
    const state = this.tailStates.get(serverId);
    return !!state && state.isActive;
  }

  /**
   * Read new lines from the log file
   */
  private async readNewLines(state: TailState): Promise<void> {
    if (!state.isActive) return;

    try {
      const stats = fs.statSync(state.logPath);

      // File was truncated or rotated
      if (stats.size < state.filePosition) {
        state.filePosition = 0;
      }

      // No new content
      if (stats.size === state.filePosition) {
        return;
      }

      // Create read stream from current position
      const stream = fs.createReadStream(state.logPath, {
        start: state.filePosition,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!state.isActive) break;

        const logEntry = this.parseLogLine(line);
        if (logEntry) {
          state.callback(logEntry);
        }
      }

      // Update file position
      state.filePosition = stats.size;
    } catch (error) {
      // File might not exist yet or be temporarily inaccessible
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error(`[LogTail] Error reading log file for ${state.serverId}:`, error);
      }
    }
  }

  /**
   * Parse a log line into a structured LogEntry
   * Handles common Java server log formats
   */
  private parseLogLine(line: string): LogEntry | null {
    if (!line.trim()) return null;

    // Common log formats:
    // [HH:MM:SS] [Thread/LEVEL]: Message
    // [HH:MM:SS INFO]: Message
    // YYYY-MM-DD HH:MM:SS [LEVEL] Message

    const timestamp = new Date();
    let level: 'info' | 'warn' | 'error' | 'debug' = 'info';
    let message = line;
    let source: string | undefined;

    // Try to parse format: [HH:MM:SS] [Source/LEVEL]: Message
    const minecraftMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*\[([^\]]+)\/([A-Z]+)\]:\s*(.+)$/);
    if (minecraftMatch) {
      const [, time, src, lvl, msg] = minecraftMatch;
      source = src;
      message = msg;
      level = this.normalizeLevel(lvl);

      // Set time on today's date
      const [hours, minutes, seconds] = time.split(':').map(Number);
      timestamp.setHours(hours, minutes, seconds, 0);
    } else {
      // Try simpler format: [HH:MM:SS LEVEL]: Message
      const simpleMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\s+([A-Z]+)\]:\s*(.+)$/);
      if (simpleMatch) {
        const [, time, lvl, msg] = simpleMatch;
        message = msg;
        level = this.normalizeLevel(lvl);

        const [hours, minutes, seconds] = time.split(':').map(Number);
        timestamp.setHours(hours, minutes, seconds, 0);
      }
    }

    // Detect level from message content if not parsed
    if (level === 'info') {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('failed')) {
        level = 'error';
      } else if (lowerLine.includes('warn')) {
        level = 'warn';
      } else if (lowerLine.includes('debug')) {
        level = 'debug';
      }
    }

    return {
      timestamp,
      level,
      message,
      source,
    };
  }

  /**
   * Normalize log level string to our enum
   */
  private normalizeLevel(level: string): 'info' | 'warn' | 'error' | 'debug' {
    const upper = level.toUpperCase();
    switch (upper) {
      case 'ERROR':
      case 'SEVERE':
      case 'FATAL':
        return 'error';
      case 'WARN':
      case 'WARNING':
        return 'warn';
      case 'DEBUG':
      case 'TRACE':
      case 'FINE':
      case 'FINER':
      case 'FINEST':
        return 'debug';
      default:
        return 'info';
    }
  }

  /**
   * Stop all tailing (for cleanup)
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.tailStates.keys()).map(
      (serverId) => this.stopTailing(serverId)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Find the log file path for a server
   * Searches common locations
   */
  static findLogFile(serverPath: string): string | null {
    const possiblePaths = [
      path.join(serverPath, 'logs', 'latest.log'),
      path.join(serverPath, 'logs', 'server.log'),
      path.join(serverPath, 'server.log'),
      path.join(serverPath, 'latest.log'),
    ];

    for (const logPath of possiblePaths) {
      if (fs.existsSync(logPath)) {
        return logPath;
      }
    }

    // Return default path even if not found yet
    return path.join(serverPath, 'logs', 'latest.log');
  }
}
