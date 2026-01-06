import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import config, { getBasePath_ } from './config';
import logger from './utils/logger';

// Services
import { ServerService } from './services/ServerService';
import { ConsoleService } from './services/ConsoleService';
import { ModService } from './services/ModService';
import { PlayerService } from './services/PlayerService';
import { BackupService } from './services/BackupService';
import { SchedulerService } from './services/SchedulerService';
import { FileService } from './services/FileService';
import { MetricsService } from './services/MetricsService';
import { WorldsService } from './services/WorldsService';
import { AlertsService } from './services/AlertsService';
import { AutomationRulesService } from './services/AutomationRulesService';
import { DiscordNotificationService } from './services/DiscordNotificationService';
import { NetworkService } from './services/NetworkService';
import { PermissionService } from './services/PermissionService';
import { SettingsService } from './services/SettingsService';
import { FtpStorageService } from './services/FtpStorageService';
import { ActivityLogService } from './services/ActivityLogService';

// Routes
import { createServerRoutes } from './routes/servers';
import { createSettingsRoutes, applyDiscordSettings, applyFtpSettings } from './routes/settings';
import { createModtaleRoutes } from './routes/modtale';
import { createAuthRoutes } from './routes/auth';
import { createUserRoutes } from './routes/users';
import { createNetworkRoutes } from './routes/networks';
import { createPermissionRoutes } from './routes/permissions';
import { createAlertsRoutes } from './routes/alerts';
import { createDashboardRoutes } from './routes/dashboard';
import activityRoutes from './routes/activity';
import systemRoutes from './routes/system';

// WebSocket
import { ServerEvents } from './websocket/ServerEvents';
import { ConsoleEvents } from './websocket/ConsoleEvents';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { configureSecurityHeaders, enforceHTTPS } from './middleware/security';
import { authenticate } from './middleware/auth';
import { activityLoggerMiddleware } from './middleware/activityLogger';

export class App {
  public express: Express;
  public httpServer: HTTPServer;
  public io: SocketServer;
  private prisma: PrismaClient;

  // Services
  private serverService: ServerService;
  private consoleService: ConsoleService;
  private modService: ModService;
  private playerService: PlayerService;
  private backupService: BackupService;
  private schedulerService: SchedulerService;
  private fileService: FileService;
  private metricsService: MetricsService;
  private worldsService: WorldsService;
  private alertsService: AlertsService;
  private automationRulesService: AutomationRulesService;
  private discordService: DiscordNotificationService;
  private networkService: NetworkService;
  private permissionService: PermissionService;
  private settingsService: SettingsService;
  private ftpService: FtpStorageService;
  private activityLogService: ActivityLogService;

  // WebSocket handlers
  private serverEvents: ServerEvents;
  private consoleEvents: ConsoleEvents;

  constructor() {
    this.express = express();
    this.httpServer = new HTTPServer(this.express);
    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
      },
      pingInterval: config.wsPingInterval,
      pingTimeout: config.wsPingTimeout,
    });

    this.prisma = new PrismaClient();

    // Initialize permission and settings services
    this.permissionService = new PermissionService(this.prisma);
    this.settingsService = new SettingsService(this.prisma);

    // Initialize activity log service
    this.activityLogService = new ActivityLogService(this.prisma);

    // Make services available to middleware via Express app
    this.express.set('permissionService', this.permissionService);
    this.express.set('settingsService', this.settingsService);
    this.express.set('activityLogService', this.activityLogService);

    // Initialize Discord notification service (will be updated with DB settings on start)
    this.discordService = new DiscordNotificationService({
      enabled: config.discord.enabled,
      webhookUrl: config.discord.webhookUrl,
      username: config.discord.username,
      avatarUrl: config.discord.avatarUrl,
      enabledEvents: config.discord.enabledEvents as any[],
      mentionRoleId: config.discord.mentionRoleId,
    });

    // Initialize FTP service (will be updated with DB settings on start)
    this.ftpService = new FtpStorageService();

    // Initialize services
    this.serverService = new ServerService(this.prisma, this.discordService);
    this.consoleService = new ConsoleService(this.prisma);
    this.modService = new ModService(this.prisma);
    this.playerService = new PlayerService(this.prisma, this.discordService);
    this.backupService = new BackupService(this.discordService);
    this.networkService = new NetworkService(this.prisma, this.serverService, this.backupService);
    this.schedulerService = new SchedulerService(
      this.serverService,
      this.backupService,
      this.consoleService
    );
    this.fileService = new FileService();
    this.metricsService = new MetricsService();
    this.worldsService = new WorldsService();
    this.alertsService = new AlertsService(this.discordService);
    this.automationRulesService = new AutomationRulesService(this.serverService as any, this.backupService);

    // Initialize WebSocket handlers
    this.serverEvents = new ServerEvents(this.io, this.serverService, this.consoleService);
    this.consoleEvents = new ConsoleEvents(this.io, this.serverService, this.consoleService);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSocket();
    this.initializeErrorHandlers();
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // HTTPS enforcement (production only)
    enforceHTTPS(this.express);

    // Security headers
    configureSecurityHeaders(this.express);

    // CORS
    this.express.use(cors({
      origin: config.corsOrigin,
      credentials: true,
    }));

    // Body parsing
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));

    // Cookie parsing
    this.express.use(cookieParser());

    // Request logging
    this.express.use(requestLogger);

    // Activity logger (captures IP, user agent for activity logging)
    this.express.use(activityLoggerMiddleware);

    // Rate limiting for API routes
    this.express.use('/api/', apiLimiter);

    logger.info('Middleware initialized');
  }

  /**
   * Initialize API routes
   */
  private initializeRoutes(): void {
    // Health check
    this.express.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    // Auth routes (public - no authentication required)
    this.express.use('/api/auth', createAuthRoutes());

    // Protected routes (authentication required)
    this.express.use('/api/servers', authenticate, createServerRoutes(
      this.serverService,
      this.consoleService,
      this.modService,
      this.playerService,
      this.backupService,
      this.schedulerService,
      this.fileService,
      this.metricsService,
      this.worldsService,
      this.alertsService,
      this.automationRulesService
    ));

    this.express.use(
      '/api/settings',
      authenticate,
      createSettingsRoutes(this.settingsService, this.discordService, this.ftpService)
    );

    this.express.use('/api/modtale', authenticate, createModtaleRoutes());

    this.express.use('/api/users', authenticate, createUserRoutes());

    this.express.use('/api/networks', authenticate, createNetworkRoutes(this.networkService));

    this.express.use(
      '/api/permissions',
      authenticate,
      createPermissionRoutes(this.permissionService)
    );

    this.express.use('/api/activity', activityRoutes);

    this.express.use('/api/alerts', authenticate, createAlertsRoutes(this.alertsService));

    this.express.use(
      '/api/dashboard',
      authenticate,
      createDashboardRoutes(this.metricsService, this.alertsService)
    );

    // System routes (version, health - no auth required for basic endpoints)
    this.express.use('/api/system', systemRoutes);

    // Serve static frontend files in production
    if (config.nodeEnv === 'production') {
      const publicPath = path.join(getBasePath_(), 'public');
      this.express.use(express.static(publicPath));

      // SPA fallback - serve index.html for any non-API routes
      this.express.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api/') || req.path === '/health') {
          return next();
        }
        res.sendFile(path.join(publicPath, 'index.html'));
      });

      logger.info(`Serving frontend from ${publicPath}`);
    }

    logger.info('Routes initialized');
  }

  /**
   * Initialize WebSocket event handlers
   */
  private initializeWebSocket(): void {
    this.serverEvents.initialize();
    this.consoleEvents.initialize();

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    logger.info('WebSocket initialized');
  }

  /**
   * Initialize error handlers (must be last)
   */
  private initializeErrorHandlers(): void {
    this.express.use(notFoundHandler);
    this.express.use(errorHandler);

    logger.info('Error handlers initialized');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Connect to database
      await this.prisma.$connect();
      logger.info('Database connected');

      // Initialize permission system
      await this.permissionService.initialize();
      logger.info('Permission system initialized');

      // Initialize settings system
      await this.settingsService.initialize();
      await this.settingsService.migrateFromEnvVars();
      logger.info('Settings system initialized');

      // Apply settings to services from database
      await applyDiscordSettings(this.settingsService, this.discordService);
      await applyFtpSettings(this.settingsService, this.ftpService);
      logger.info('Settings applied to services');

      // Recover orphaned servers (servers that were running before manager restart)
      await this.serverService.recoverOrphanedServers();
      logger.info('Server recovery complete');

      // Load scheduled tasks
      await this.schedulerService.loadTasks();
      logger.info('Scheduled tasks loaded');

      // Start metrics collection
      await this.metricsService.startCollection();
      logger.info('Metrics collection started');

      // Start alert monitoring
      await this.alertsService.startMonitoring();
      logger.info('Alert monitoring started');

      // Initialize automation rules
      await this.automationRulesService.initialize();
      logger.info('Automation rules initialized');

      // Start HTTP server
      this.httpServer.listen(config.port, () => {
        logger.info(`Server started on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`CORS origin: ${config.corsOrigin}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    try {
      // Close WebSocket connections
      this.io.close();
      logger.info('WebSocket server closed');

      // Cleanup services
      this.schedulerService.cleanup();
      this.metricsService.stopCollection();
      this.alertsService.stopMonitoring();
      this.automationRulesService.cleanup();
      await this.serverService.cleanup();
      await this.consoleEvents.cleanup();
      this.serverEvents.cleanup();
      logger.info('Services cleaned up');

      // Disconnect from database
      await this.prisma.$disconnect();
      logger.info('Database disconnected');

      // Close HTTP server
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.warn('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}
