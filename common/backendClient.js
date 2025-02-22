const fs = require('fs');
const axios = require('axios');
const path = require('path');
const os = require('os');
const macaddress = require('macaddress');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
console.log("📂 Checking .env file path:", path.resolve(__dirname, '../.env'));
console.log("🔍 Loaded SECRET_KEY:", process.env.SECRET_KEY);
console.log("🔍 Loaded AGENT_API_KEY:", process.env.AGENT_API_KEY);
console.log("🔍 Loaded SECRET_KEY:", process.env.SECRET_KEY);
class BackendClient {
    constructor(platform) {
        this.platform = platform;
        this.baseURL = process.env.BACKEND_URL || 'http://localhost:4000';
        this.envFilePath = path.join(__dirname, '../.env');
        this.apiKey = process.env.AGENT_API_KEY || this.loadApiKey(); // 🛠️ אם אין API_KEY, נטען אותו מהקובץ .env
    }


    async getMacAddress() {
        return new Promise((resolve, reject) => {
            macaddress.one((err, mac) => {
                if (err) {
                    console.error("❌ Error retrieving MAC address:", err);
                    return reject(new Error(`MAC Address Retrieval Failed: ${err.message || err}`));
                }
                resolve(mac);
            });
        });
    }

    getIpAddress() {
        const nets = os.networkInterfaces();
        let ip = '127.0.0.1';

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`📌 Found IP Address on interface ${name}: ${net.address}`);
                    return net.address;
                }
            }
        }
        console.warn("⚠️ No external IP address found, using localhost.");
        return ip;
    }

    async registerDevice() {
        console.log("📤 Sending device registration request...");
        if (this.apiKey) {
            console.log("🔑 AGENT_API_KEY already exists in .env");
            return;
        }

        try {
            const macAddress = await this.getMacAddress();
            const ipAddress = this.getIpAddress();

            const payload = {
                deviceId: os.hostname(),
                name: os.hostname(),
                platform: this.platform,
                os: this.platform,
                osVersion: os.release(),
                cpu: os.cpus()[0].model,
                memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
                macAddress,
                ipAddress
            };

            console.log("📤 Sending device registration request with data:", payload);
            const response = await axios.post(`${this.baseURL}/api/devices/register`, payload);

            if (response.data.apiKey) {
                this.apiKey = response.data.apiKey;
                this.saveToEnvFile("AGENT_API_KEY", this.apiKey);
                console.log("✅ AGENT_API_KEY saved to .env");
            } else {
                console.error("❌ API Key not received from backend!");
            }
        } catch (error) {
            console.error("❌ Error registering device:", error.response ? error.response.data : error.message);
        }
    }

    async sendCommand(command) {
        if (!this.apiKey) {
            console.error("❌ API Key is missing! Device must be registered first.");
            return;
        }
    
        try {
            const response = await axios.post(`${this.baseURL}/api/devices/command`, { command }, {
                headers: { Authorization: `Bearer ${this.apiKey}` } // ✅ טוקן נוסף לכותרת
            });
    
            console.log(`📡 Command executed: ${command}`);
            console.log("📥 Response:", response.data);
            return response.data;
        } catch (error) {
            console.error("❌ Error sending command:", error.response ? error.response.data : error.message);
            console.log("📡 Sending Authorization Header:", { Authorization: `Bearer ${this.apiKey}` });
        }
    }

    loadApiKey() {
        console.log("📤 Trying to load API Key from .env file...");
        console.log("📂 Checking .env file at:", this.envFilePath);
    
        if (fs.existsSync(this.envFilePath)) {
            const envData = fs.readFileSync(this.envFilePath, 'utf8');
    
            if (!envData.trim()) {
                console.warn("⚠️ .env file is empty!");
                return null;
            }
    
            console.log("🔍 Loaded .env content:\n", envData); // ✅ הדפסת תוכן הקובץ
        
            const regex = /^AGENT_API_KEY=(.*)$/m;
            const match = regex.exec(envData); // ✅ שימוש ב-exec() במקום match()
            
            if (match) {
                const apiKey = match[1].trim(); // ✅ ניקוי רווחים מיותרים
                console.log("🔍 Extracted API Key from .env:", apiKey);
                return apiKey;
            } else {
                console.warn("⚠️ AGENT_API_KEY not found in .env");
                return null;
            }
        } else {
            console.warn("⚠️ .env file not found at path:", this.envFilePath);
        }
        
        console.log("🚫 Returning NULL for API Key.");
        return null;
    }
    
    saveToEnvFile(key, value) {
        let envData = fs.existsSync(this.envFilePath) ? fs.readFileSync(this.envFilePath, 'utf8') : '';
    
        const regex = new RegExp(`^${key}=.*$`, "m");
        const match = regex.exec(envData); // ✅ שימוש ב-exec() במקום match()
    
        if (match) {
            envData = envData.replace(regex, `${key}=${value}`);
            console.log(`🔄 Updated ${key} in .env file.`);
        } else {
            envData += `\n${key}=${value}`;
            console.log(`🆕 Added ${key} to .env file.`);
        }
    
        fs.writeFileSync(this.envFilePath, envData);
        console.log("✅ .env file successfully updated.");
    }
}
module.exports = BackendClient;