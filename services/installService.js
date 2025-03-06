const { exec } = require('child_process');
const Logger = require('../common/logger');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * שירות להתקנת תוכנות
 */
class InstallService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'agent-downloads');

    // ✅ יצירת התיקייה אם לא קיימת
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 📥 הורדה והתקנה של תוכנה לפי URL
   */
  installSoftware(softwareUrl) {
    return new Promise((resolve, reject) => {
      if (!softwareUrl || !this.isValidUrl(softwareUrl)) {
        return reject(new Error('❌ Invalid software URL'));
      }

      const fileName = path.basename(softwareUrl);
      const downloadPath = path.join(this.tempDir, fileName);

      Logger.info(`📥 Downloading software from: ${softwareUrl}`);
      Logger.info(`📦 Download location: ${downloadPath}`);

      let installCommand = "";

      if (process.platform === 'darwin') {
        // ✅ macOS
        if (fileName.endsWith('.pkg')) {
          installCommand = `
            curl -sL "${softwareUrl}" -o "${downloadPath}" &&
            sudo installer -pkg "${downloadPath}" -target / &&
            rm -f "${downloadPath}"
          `;
        } else if (fileName.endsWith('.dmg')) {
          // ✅ תהליך התקנה אוטומטי מקובץ DMG
          installCommand = `
            curl -sL "${softwareUrl}" -o "${downloadPath}" &&
            hdiutil attach "${downloadPath}" -nobrowse -quiet &&
            sudo cp -R "/Volumes/*/*.app" /Applications/ &&
            hdiutil detach "/Volumes/*" -quiet &&
            rm -f "${downloadPath}"
          `;
        } else {
          return reject(new Error('❌ Unsupported file format for macOS installation'));
        }
      } else if (process.platform === 'win32') {
        // ✅ Windows
        if (fileName.endsWith('.exe') || fileName.endsWith('.msi')) {
          installCommand = `
            powershell -Command "Invoke-WebRequest -Uri '${softwareUrl}' -OutFile '${downloadPath}';
            Start-Process -Wait '${downloadPath}' -ArgumentList '/quiet';
            Remove-Item -Force '${downloadPath}'"
          `;
        } else {
          return reject(new Error('❌ Unsupported file format for Windows installation'));
        }
      } else {
        // ✅ Linux
        if (fileName.endsWith('.deb')) {
          installCommand = `
            wget -q "${softwareUrl}" -O "${downloadPath}" &&
            sudo dpkg -i "${downloadPath}" &&
            rm -f "${downloadPath}"
          `;
        } else if (fileName.endsWith('.rpm')) {
          installCommand = `
            wget -q "${softwareUrl}" -O "${downloadPath}" &&
            sudo rpm -i "${downloadPath}" &&
            rm -f "${downloadPath}"
          `;
        } else {
          return reject(new Error('❌ Unsupported file format for Linux installation'));
        }
      }

      Logger.info(`⚙️ Running installation command: ${installCommand}`);

      exec(installCommand, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`❌ Software installation error: ${error.message}`);
          return reject(error);
        }

        Logger.info(`✅ Software installed successfully`);
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * 🛡️ בדיקת תקינות URL
   */
  isValidUrl(url) {
    const regex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/gm;
    return regex.test(url);
  }
}

module.exports = InstallService;