const path = require('path');
const { Tray, Menu } = require('electron');

class TrayManager {
    constructor(iconPath) {
        const resolvedPath = path.resolve(iconPath);
        console.log("📌 Using icon path:", resolvedPath); // בדיקת הנתיב במסוף

        this.tray = new Tray(resolvedPath);
        this.tray.setToolTip('macOS Agent');
        this._buildMenu();
    }

    _buildMenu() {
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Device Status', enabled: false },
            { type: 'separator' },
            { label: 'Open Logs', click: () => this._openLogs() },
            { label: 'Quit', role: 'quit' }
        ]);
        this.tray.setContextMenu(contextMenu);
    }

    _openLogs() {
        require('child_process').exec('open /var/log/agent.log');
    }
}

module.exports = TrayManager;