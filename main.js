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

// Standard Chrome User-Agent to bypass basic bot checks
const SPOOFED_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
    // Spoof User-Agent globally for the session
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = SPOOFED_UA;
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        details.requestHeaders['Sec-Fetch-Dest'] = 'document';
        details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
        details.requestHeaders['Sec-Fetch-Site'] = 'none';
        details.requestHeaders['Sec-Fetch-User'] = '?1';
        details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
        
        // Strip out Electron/Node specific headers if they sneak in
        delete details.requestHeaders['sec-ch-ua'];
        
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

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
    if (extractionWindow && !extractionWindow.isDestroyed()) {
        extractionWindow.close();
    }
    
    extractionWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        show: true, 
        webPreferences: {
            webSecurity: false,
            plugins: true,
            backgroundThrottling: false,
            // Disable features that fingerprint as a bot
            enableRemoteModule: false,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // Mask webdriver and other bot-like properties immediately upon document creation
    extractionWindow.webContents.on('did-start-navigation', () => {
        if (extractionWindow && !extractionWindow.isDestroyed()) {
            extractionWindow.webContents.executeJavaScript(`
                try {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] }); // Fake plugins array length
                    window.chrome = { runtime: {} }; // Fake chrome object
                } catch (e) {}
            `).catch(() => { /* Ignore execution errors on rapid navigation */ });
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
                    try {
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
                    } catch (e) {}
                }, 2000);
            `).catch(() => { /* Ignore execution errors if frame is destroyed */ });
        }
    });

    extractionWindow.loadURL(targetUrl, { userAgent: SPOOFED_UA });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});