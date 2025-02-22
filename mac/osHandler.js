const { exec } = require('child_process');

class OSHandler {
    static shutdown() {
        exec('sudo shutdown -h now');
    }
}

module.exports = OSHandler;