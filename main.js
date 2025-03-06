const { app } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');
const Logger = require('./common/logger');
const BackendClient = require('./common/backendClient');
const TrayManager = require('./mac/trayManager');
const { checkidKey } = require('./common/api-key-checker');
const CommandService = require('./services/commandService');
const InstallService = require('./services/installService');
const StatusService = require('./services/statusService');

// מניעת ריבוי מופעים של האפליקציה
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  Logger.info("🔒 Another instance is already running. Quitting.");
  app.quit();
} else {
  // הגדרת משתנים גלובליים
  global.isOnline = false;
  global.lastCommandTime = null;
  global.lastCommandStatus = null;

  // נתיבים לקבצי תצורה
  const iconPath = path.join(__dirname, 'mac', 'assets', 'icon.png');
  const iconOnlinePath = path.join(__dirname, 'mac', 'assets', 'icon-online.png');
  const iconOfflinePath = path.join(__dirname, 'mac', 'assets', 'icon-offline.png');

  // יצירת client לשרת הראשי
  const backendClient = new BackendClient('macos');

  // בדיקת API Key בהפעלה
  const idKey = checkidKey();

  // יצירת שירותים
  const statusService = new StatusService(backendClient);
  const commandService = new CommandService();
  const installService = new InstallService();

  // הגדרת Express server עבור קבלת פקודות
  function setupServer() {
    const agentServer = express();
    agentServer.use(express.json());

    // מידלוור לאימות API Key
    function validateidKey(req, res, next) {
      const authHeader = req.headers.authorization;
      const configFile = path.join(__dirname, 'common', 'agentConfig.json');
      
      let idKey = null;
      
      // קריאה של ה-API Key מקובץ הקונפיגורציה
      try {
        if (fs.existsSync(configFile)) {
          const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          idKey = config.idKey;
          Logger.info("✅ API Key loaded from config file");
        }
      } catch (error) {
        Logger.error('❌ Error reading API Key from config file:', error);
      }
      
      // אם לא נמצא בקובץ, ננסה לקרוא מה-.env
      if (!idKey && process.env.AGENT_API_KEY) {
        idKey = process.env.AGENT_API_KEY;
        Logger.info("✅ API Key loaded from environment variable");
      }
      
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== idKey) {
        Logger.error('❌ Authentication failed: Invalid API Key');
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
      }
      
      next();
    }

    // נקודת קצה לביצוע פקודות
    agentServer.post('/execute', validateidKey, (req, res) => {
      const { command } = req.body;
      
      if (!command) {
        Logger.error('❌ No command provided');
        return res.status(400).json({ error: 'No command provided' });
      }
      
      Logger.info(`📌 Executing command: ${command}`);
      
      // ביצוע הפקודה באמצעות CommandService
      commandService.executeCommand(command)
        .then(result => {
          global.lastCommandTime = new Date();
          global.lastCommandStatus = 'success';
          Logger.info(`✅ Command executed successfully`);
          res.json({ output: result.stdout, stderr: result.stderr });
        })
        .catch(error => {
          global.lastCommandTime = new Date();
          global.lastCommandStatus = 'failure';
          Logger.error(`❌ Command execution error: ${error.message}`);
          return res.status(500).json({ 
            error: 'Command execution failed', 
            details: error.message 
          });
        });
    });
    
    // נקודת קצה להתקנת תוכנה
    agentServer.post('/install', validateidKey, (req, res) => {
      const { softwareUrl } = req.body;
      
      if (!softwareUrl) {
        Logger.error('❌ No software URL provided');
        return res.status(400).json({ error: 'No software URL provided' });
      }
      
      Logger.info(`📌 Installing software from: ${softwareUrl}`);
      
      // התקנת התוכנה באמצעות InstallService
      installService.installSoftware(softwareUrl)
        .then(result => {
          Logger.info(`✅ Software installed successfully`);
          res.json({ message: 'Software installed successfully', output: result.stdout });
        })
        .catch(error => {
          Logger.error(`❌ Software installation error: ${error.message}`);
          return res.status(500).json({ 
            error: 'Software installation failed', 
            details: error.message 
          });
        });
    });

    // נקודת קצה לקבלת סטטוס
    agentServer.get('/status', validateidKey, (req, res) => {
      const status = {
        isOnline: global.isOnline,
        lastCommandTime: global.lastCommandTime,
        lastCommandStatus: global.lastCommandStatus,
        hostname: require('os').hostname(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
      
      res.json(status);
    });
    
    return agentServer;
  }

  // כאשר האפליקציה מוכנה
  app.whenReady().then(async () => {
    try {
      // רישום המכשיר בשרת הראשי
      await backendClient.registerDevice();
      Logger.info("✅ Device registered with backend");
      
      // עדכון הסטטוס הגלובלי
      global.isOnline = true;
      
      // יצירת אייקון במגש המערכת עם הממשק
      const trayManager = new TrayManager({
        iconPath,
        iconOnlinePath,
        iconOfflinePath,
        backendClient
      });
      
      // הקמת השרת
      const agentServer = setupServer();
      
      // הפעלת השרת
      const PORT = process.env.AGENT_PORT || 3001;
      agentServer.listen(PORT, () => {
        Logger.info(`🚀 Agent listening on port ${PORT} for command execution`);
      });
      
      // עדכון סטטוס תקופתי
      statusService.startStatusUpdateInterval();
      
    } catch (error) {
      Logger.error("❌ Error during agent startup:", error.message);
      global.isOnline = false;
    }
  });

  // כאשר האפליקציה נסגרת
  app.on('before-quit', async () => {
    Logger.info("🛑 Application is shutting down...");
    await statusService.updateStatus('offline');
    Logger.info("✅ Status updated: offline");
  });

  // לכידת אירועים מהמערכת
  app.on('second-instance', () => {
    Logger.info("🔄 Another instance was opened. Focusing this one.");
    // אם יש חלון פתוח, התמקד בו
    if (TrayManager.getWindow()) {
      const win = TrayManager.getWindow();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}