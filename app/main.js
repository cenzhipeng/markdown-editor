const {app, BrowserWindow} = require('electron');
let mainWindow = null;

function appReady() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadFile('app/index.html');
    mainWindow.on('close', () => {
        mainWindow = null; // 关闭窗口后，将其设为 null
    });
}

app.whenReady()
    .then(appReady);