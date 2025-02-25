const { app } = require('electron');
const path = require('path');
const Logger = require('./common/logger');
const BackendClient = require('./common/backendClient');
const TrayManager = require('./mac/trayManager');

const iconPath = path.join(__dirname, 'mac', 'assets', 'icon.png');
const backendClient = new BackendClient('macos');

app.whenReady().then(async () => {
    try {
        await backendClient.registerDevice();
        new TrayManager(iconPath);
        Logger.info("✅ Agent started on macOS");

        // שליחת פקודה להרצת ifconfig
        if (typeof backendClient.sendCommand === 'function') {
            await backendClient.sendCommand('ifconfig');
        } else {
            console.warn("⚠️ Warning: `sendCommand` is not defined in BackendClient.");
        }
    } catch (error) {
        console.error("❌ Error during agent startup:", error.message);
    }
});