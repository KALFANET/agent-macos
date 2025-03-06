const fs = require('fs');
const axios = require('axios');
const path = require('path');
const os = require('os');
const macaddress = require('macaddress');
const Logger = require('./logger');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

Logger.info("📂 Checking .env file path:", path.resolve(__dirname, '../.env'));
Logger.info("🔍 Loaded AGENT_API_KEY:", process.env.AGENT_API_KEY ? "[EXISTS]" : "[MISSING]");

class BackendClient {
    constructor(platform) {
        this.platform = platform;
        this.baseURL = process.env.BACKEND_URL || null; // נאתר את הכתובת אוטומטית
        this.agentPort = process.env.AGENT_PORT || 3001;
        this.agentURL = `http://localhost:${this.agentPort}`;
        this.envFilePath = path.join(__dirname, '../.env');
        this.apiKey = process.env.AGENT_API_KEY || null;
        this.configFile = path.join(__dirname, 'agentConfig.json');

        this.loadApiKey();
    }

    // 📌 פונקציה לאיתור כתובת ה-Backend אוטומטית
    async detectBackendURL() {
        const knownHosts = [
            'http://localhost:4000/api',
            'http://192.168.1.100:4000/api',
            'http://192.168.1.101:4000/api',
            'http://192.168.1.102:4000/api'
        ];

        try {
            Logger.info("🔍 Trying to detect backend server...");
            for (const host of knownHosts) {
                try {
                    const response = await axios.get(`${host}/server-ip`, { timeout: 3000 });
                    if (response.data.serverIp) {
                        this.baseURL = `http://${response.data.serverIp}:4000/api`;
                        Logger.info(`✅ Backend detected at ${this.baseURL}`);
                        this.saveToEnvFile("BACKEND_URL", this.baseURL);
                        return;
                    }
                } catch (err) {
                    Logger.warn(`⚠️ No response from ${host}, trying next...`);
                }
            }
            Logger.error("❌ Could not detect backend server. Using fallback (localhost).");
            this.baseURL = 'http://localhost:4000/api';
        } catch (error) {
            Logger.error("❌ Error detecting backend:", error.message);
            this.baseURL = 'http://localhost:4000/api';
        }
    }

    async loadApiKey() {
        try {
            if (fs.existsSync(this.configFile)) {
                const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                if (config.apiKey) {
                    this.apiKey = config.apiKey;
                    Logger.info("✅ API Key loaded from config file");
                    return;
                }
            }
        } catch (error) {
            Logger.error(`❌ Error loading API Key from config file: ${error.message}`);
        }

        if (process.env.AGENT_API_KEY) {
            this.apiKey = process.env.AGENT_API_KEY;
            Logger.info("✅ API Key loaded from environment variable");
        } else {
            Logger.warn("⚠️ No API Key found");
        }
    }

    async getMacAddress() {
        return new Promise((resolve, reject) => {
            macaddress.one((err, mac) => {
                if (err) {
                    Logger.error("❌ Error retrieving MAC address:", err);
                    return reject(new Error(`MAC Address Retrieval Failed: ${err.message || err}`));
                }
                Logger.info(`✅ MAC Address retrieved: ${mac}`);
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
                    Logger.info(`📌 Found IP Address on interface ${name}: ${net.address}`);
                    return net.address;
                }
            }
        }
        Logger.warn("⚠️ No external IP address found, using localhost.");
        return ip;
    }

    async registerDevice() {
        await this.detectBackendURL(); // 🚀 נאתר את כתובת ה-Backend לפני רישום

        Logger.info("📤 Checking if device is already registered...");
        try {
            const macAddress = await this.getMacAddress();
            const ipAddress = this.getIpAddress();

            const payload = {
                idKey: os.hostname(),
                name: os.hostname(),
                platform: this.platform,
                os: this.platform,
                osVersion: os.release(),
                cpu: os.cpus()[0].model,
                memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
                macAddress,
                ipAddress
            };

            Logger.info("📤 Sending device registration request with data:", payload);
            const response = await axios.post(`${this.baseURL}/devices/register`, payload);

            if (response.data.apiKey) {
                this.apiKey = response.data.apiKey;
                this.saveToEnvFile("AGENT_API_KEY", this.apiKey);
                Logger.info("✅ AGENT_API_KEY saved to .env");

                fs.writeFileSync(this.configFile, JSON.stringify({ apiKey: this.apiKey }, null, 2));
                Logger.info("✅ API Key saved to config file");

                return this.apiKey;
            } else {
                Logger.error("❌ API Key not received from backend!");
                return null;
            }
        } catch (error) {
            Logger.error("❌ Error registering device:", error.response ? error.response.data : error.message);
            return null;
        }
    }

    async updateStatus(status) {
        if (!this.apiKey) {
            Logger.error("❌ Cannot update status: Missing API Key");
            return false;
        }

        try {
            Logger.info(`📤 Updating device status to: ${status}`);
            const idKey = os.hostname();
            const response = await axios.put(`${this.baseURL}/devices/status/${idKey}`, 
                { status },
                { headers: { Authorization: `Bearer ${this.apiKey}` } }
            );

            Logger.info("✅ Status updated successfully");
            return true;
        } catch (error) {
            Logger.error("❌ Error updating status:", error.response ? error.response.data : error.message);
            return false;
        }
    }

    async getDeviceInfo() {
        if (!this.apiKey) {
            Logger.error("❌ Cannot get device info: Missing API Key");
            return null;
        }

        try {
            Logger.info(`📤 Getting device info`);
            const idKey = os.hostname();
            const response = await axios.get(`${this.baseURL}/devices/${idKey}`, 
                { headers: { Authorization: `Bearer ${this.apiKey}` } }
            );

            Logger.info("✅ Device info received successfully");
            return response.data;
        } catch (error) {
            Logger.error("❌ Error getting device info:", error.response ? error.response.data : error.message);
            return null;
        }
    }

    saveToEnvFile(key, value) {
        let envData = fs.existsSync(this.envFilePath) ? fs.readFileSync(this.envFilePath, 'utf8') : '';

        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envData)) {
            envData = envData.replace(regex, `${key}=${value}`);
            Logger.info(`🔄 Updated ${key} in .env file.`);
        } else {
            envData += `\n${key}=${value}`;
            Logger.info(`🆕 Added ${key} to .env file.`);
        }

        fs.writeFileSync(this.envFilePath, envData);
        Logger.info("✅ .env file successfully updated.");
    }
}

module.exports = BackendClient;