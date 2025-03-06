const { Tray, Menu, BrowserWindow, app, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const Logger = require('../common/logger');

class TrayManager {
  constructor({ backendClient }) {
    this.backendClient = backendClient;
    this.tray = null;
    this.window = null;

    this.iconNormal = this.loadIcon('./assets/macOS_icon_styled_Normal.png', 32);
    this.iconDark = this.loadIcon('./assets/macOS_icon_styled_Dark_Normal.png', 32);
    this.iconOnline = this.loadIcon('./assets/macOS_icon_styled_Normal_2x.png', 32);
    this.iconOffline = this.loadIcon('./assets/macOS_icon_styled_Dark_Normal_2x.png', 32);

    this.setupTray();

    TrayManager._window = this.window;
  }

  static getWindow() {
    return TrayManager._window;
  }

  /**
   * 🔍 טוען את האייקון מהנתיב ובודק אם הוא תקין
   */
  loadIcon(relativePath, size = 32) {
    const iconPath = path.join(__dirname, relativePath);
    let icon = nativeImage.createFromPath(iconPath).resize({ width: size, height: size });

    if (icon.isEmpty()) {
      Logger.error(`❌ Error: Failed to load icon from ${relativePath}`);
      return nativeImage.createEmpty();
    }

    Logger.info(`✅ Loaded icon: ${relativePath} (Size: ${size}x${size})`);
    return icon;
  }

  setupTray() {
    this.tray = new Tray(global.isOnline ? this.iconOnline : this.iconOffline);
    this.tray.setToolTip('Remote Device Manager - Agent');

    this.updateTray();

    // ✅ תיקון הבעיה עם `bind(this)`
    this.tray.on('click', this.toggleWindow.bind(this));

    setInterval(() => {
      this.updateTray();
    }, 60000);
  }

  updateTray() {
    this.tray.setImage(global.isOnline ? this.iconOnline : this.iconOffline);

    const idKey = this.backendClient.idKey 
      ? `${this.backendClient.idKey.substring(0, 5)}...${this.backendClient.idKey.substring(this.backendClient.idKey.length - 5)}`
      : 'Not found';

    const contextMenu = Menu.buildFromTemplate([
      { label: `Agent: ${global.isOnline ? 'Online ✅' : 'Offline ❌'}`, enabled: false },
      { label: `Device: ${os.hostname()}`, enabled: false },
      { label: `API Key: ${idKey}`, enabled: false },
      { type: 'separator' },
      { label: 'Status Details', click: () => this.toggleWindow() },
      { 
        label: 'Update Status Online', 
        click: async () => {
          await this.backendClient.updateStatus('online');
          global.isOnline = true;
          this.updateTray();
        }
      },
      { type: 'separator' },
      { 
        label: 'Quit', 
        click: () => {
          Logger.info("👋 Quitting from tray menu");
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  toggleWindow() {
    if (this.window && this.window.isVisible()) {
      this.window.hide();
    } else {
      this.showWindow();
    }
  }

  showWindow() {
    if (!this.window) {
      this.window = new BrowserWindow({
        width: 300,
        height: 350,
        show: false,
        frame: false,
        resizable: false,
        movable: true,
        alwaysOnTop: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      this.window.loadFile(path.join(__dirname, '../ui/menu.html'));

      this.window.webContents.on('did-finish-load', () => {
        this.window.webContents.send('agent-data', {
          hostname: os.hostname(),
          status: global.isOnline ? 'online' : 'offline',
          lastCommand: global.lastCommandTime ? {
            time: global.lastCommandTime,
            status: global.lastCommandStatus
          } : null,
          ip: this.backendClient.getIpAddress(),
          idKey: this.backendClient.idKey 
            ? `${this.backendClient.idKey.substring(0, 5)}...${this.backendClient.idKey.substring(this.backendClient.idKey.length - 5)}` 
            : 'Not found'
        });
      });

      this.window.on('closed', () => {
        this.window = null;
      });

      this.window.on('blur', () => {
        this.window.hide();
      });
    }

    const trayBounds = this.tray.getBounds();
    const windowBounds = this.window.getBounds();

    let x, y;
    
    if (process.platform === 'darwin') {
      x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
      y = Math.round(trayBounds.y + trayBounds.height);
    } else {
      x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
      y = Math.round(trayBounds.y - windowBounds.height);
    }

    this.window.setPosition(x, y, false);
    this.window.show();
    this.window.focus();
  }
}

module.exports = TrayManager;