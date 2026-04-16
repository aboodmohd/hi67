const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Standup the Express backend
const server = express();
server.use(cors());
server.use(express.json());
server.post('/api/status', (req, res) => {
    res.json({ status: 'operational', message: 'Backend is hooked and listening.' });
});
server.listen(3000, () => console.log('Express backend running on port 3000'));

let mainWindow;
let extractionWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    // Hook into the network stack to sniff out m3u8 and mp4 streams
    session.defaultSession.webRequest.onBeforeRequest({
        urls: ['*://*/*.m3u8*', '*://*/*.mp4*']
    }, (details, callback) => {
        if (details.url.includes('.m3u8') || details.url.includes('.mp4')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Pipe the intercepted URL back to the renderer
                mainWindow.webContents.send('stream-intercepted', details.url);
            }
        }
        callback({ cancel: false });
    });
});

ipcMain.on('launch-extractor', (event, targetUrl) => {
    // Check if window exists and isn't already destroyed before closing
    if (extractionWindow && !extractionWindow.isDestroyed()) {
        extractionWindow.close();
    }
    
    // Spawn a hidden or secondary window to load the embed and trigger playback
    extractionWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        show: true, // Keep true for debugging, can be set to false for stealth
        webPreferences: {
            webSecurity: false,
            plugins: true
        }
    });

    extractionWindow.on('closed', () => {
        extractionWindow = null;
    });
    
    // Inject a payload to attempt auto-play if the embed requires interaction
    extractionWindow.webContents.on('dom-ready', () => {
        if (extractionWindow && !extractionWindow.isDestroyed()) {
            extractionWindow.webContents.executeJavaScript(`
                setTimeout(() => {
                    const videos = document.querySelectorAll('video');
                    const iframes = document.querySelectorAll('iframe');
                    
                    videos.forEach(v => {
                        v.muted = true;
                        v.play().catch(e => console.log('Autoplay blocked:', e));
                    });
                    
                    // Click the center of the screen to bypass click-to-play overlays
                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: window.innerWidth / 2,
                        clientY: window.innerHeight / 2
                    });
                    document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.dispatchEvent(clickEvent);
                }, 2000);
            `);
        }
    });

    extractionWindow.loadURL(targetUrl);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});