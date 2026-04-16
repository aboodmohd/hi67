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
let currentTargetUrl = ''; // Keep track of the target URL to use as referer

// Standard Chrome User-Agent to bypass basic bot checks
const SPOOFED_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Aggressive Ad & Tracker Blocklist
const AD_DOMAINS = [
    '*://*.doubleclick.net/*',
    '*://partner.googleadservices.com/*',
    '*://*.googlesyndication.com/*',
    '*://*.google-analytics.com/*',
    '*://creative.ak.fbcdn.net/*',
    '*://*.adbrite.com/*',
    '*://*.exponential.com/*',
    '*://*.quantserve.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.zedo.com/*',
    '*://*.adsafeprotected.com/*',
    '*://*.teads.tv/*',
    '*://*.outbrain.com/*',
    '*://*.taboola.com/*',
    '*://*.popads.net/*',
    '*://*.popcash.net/*',
    '*://*.propellerads.com/*',
    '*://*.onclickads.net/*',
    '*://*.exoclick.com/*',
    '*://*.adsterra.com/*',
    '*://*.juicyads.com/*',
    '*://*.ero-advertising.com/*',
    '*://*.trafficjunky.net/*',
    '*://*.trafficfactory.biz/*',
    '*://*.adcash.com/*',
    '*://*.realsrv.com/*',
    '*://*.adxadserv.com/*',
    '*://*.cpmstar.com/*',
    '*://*.ad-maven.com/*',
    '*://*.hilltopads.com/*',
    '*://*.clickadu.com/*',
    '*://*.ad-center.com/*',
    '*://*.runative-syndicate.com/*',
    '*://*.betrad.com/*',
    '*://*.bidgear.com/*',
    '*://*.adform.net/*',
    '*://*.rubiconproject.com/*',
    '*://*.casalemedia.com/*',
    '*://*.pubmatic.com/*',
    '*://*.criteo.com/*',
    '*://*.smartadserver.com/*',
    '*://*.openx.net/*',
    '*://*.spotxchange.com/*',
    '*://*.contextweb.com/*',
    '*://*.adnxs.com/*',
    '*://*.rlcdn.com/*',
    '*://*.yieldmanager.com/*',
    '*://*.advertising.com/*',
    '*://*.adtechus.com/*',
    '*://*.tremormedia.com/*',
    '*://*.specificclick.net/*',
    '*://*.fastclick.net/*',
    '*://*.atdmt.com/*',
    '*://*.tribalfusion.com/*',
    '*://*.ru4.com/*',
    '*://*.media6degrees.com/*',
    '*://*.bluekai.com/*',
    '*://*.invitemedia.com/*',
    '*://*.turn.com/*',
    '*://*.adroll.com/*',
    '*://*.mathtag.com/*',
    '*://*.demdex.net/*',
    '*://*.xaxis.com/*',
    '*://*.krxd.net/*',
    '*://*.agkn.com/*',
    '*://*.nexac.com/*',
    '*://*.tapad.com/*',
    '*://*.w55c.net/*',
    '*://*.mookie1.com/*',
    '*://*.tidaltv.com/*',
    '*://*.vindicosuite.com/*',
    '*://*.adap.tv/*',
    '*://*.innovid.com/*',
    '*://*.liverail.com/*',
    '*://*.tubemogul.com/*',
    '*://*.yuilop.com/*',
    '*://*.adxxx.com/*',
    '*://*.adultadworld.com/*',
    '*://*.plugrush.com/*',
    '*://*.adxpansion.com/*',
    '*://*.admaster.com.cn/*',
    '*://*.allyes.com/*',
    '*://*.miaozhen.com/*',
    '*://*.adbug.cn/*',
    '*://*.talkingdata.com/*',
    '*://*.nielsen.com/*',
    '*://*.comscore.com/*',
    '*://*.gemius.com/*',
    '*://*.hitwise.com/*',
    '*://*.alexa.com/*',
    '*://*.chartbeat.com/*',
    '*://*.compete.com/*',
    '*://*.omniture.com/*',
    '*://*.webtrends.com/*',
    '*://*.coremetrics.com/*',
    '*://*.kissmetrics.com/*',
    '*://*.mixpanel.com/*',
    '*://*.optimizely.com/*',
    '*://*.localytics.com/*',
    '*://*.segment.com/*',
    '*://*.heap.io/*',
    '*://*.amplitude.com/*',
    '*://*.snowplowanalytics.com/*',
    '*://*.piwik.com/*',
    '*://*.keen.io/*',
    '*://*.hotjar.com/*',
    '*://*.crazyegg.com/*',
    '*://*.mouseflow.com/*',
    '*://*.inspectlet.com/*',
    '*://*.clicktale.com/*',
    '*://*.fullstory.com/*',
    '*://*.luckyorange.com/*',
    '*://*.vwo.com/*',
    '*://*.monetate.com/*',
    '*://*.abtasty.com/*',
    '*://*.qubit.com/*',
    '*://*.apptimize.com/*',
    '*://*.dynamicyield.com/*',
    '*://*.kameleoon.com/*',
    '*://*.convert.com/*',
    '*://*.maxymiser.com/*',
    '*://*.certona.com/*',
    '*://*.richrelevance.com/*',
    '*://*.barilliance.com/*',
    '*://*.strands.com/*',
    '*://*.nosto.com/*',
    '*://*.peerius.com/*',
    '*://*.bazaarvoice.com/*',
    '*://*.yotpo.com/*',
    '*://*.turnTo.com/*',
    '*://*.powerreviews.com/*',
    '*://*.trustpilot.com/*',
    '*://*.reevoo.com/*',
    '*://*.feefo.com/*',
    '*://*.ekomi.com/*',
    '*://*.reviews.co.uk/*',
    '*://*.shopperapproved.com/*',
    '*://*.verified-reviews.com/*',
    '*://*.bizrate.com/*',
    '*://*.resellerratings.com/*',
    '*://*.trustradius.com/*',
    '*://*.sitejabber.com/*',
    '*://*.g2crowd.com/*',
    '*://*.capterra.com/*',
    '*://*.itcentralstation.com/*',
    '*://*.trustarc.com/*',
    '*://*.gartner.com/*'
];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Disable webSecurity in main window to allow playing CORS restricted streams
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
        
        // If this request is for a video stream (from the main window player), spoof Referer and Origin
        if (details.url.includes('.m3u8') || details.url.includes('.mp4') || details.url.includes('.ts')) {
            if (currentTargetUrl) {
                try {
                    const targetOrigin = new URL(currentTargetUrl).origin;
                    details.requestHeaders['Referer'] = currentTargetUrl;
                    details.requestHeaders['Origin'] = targetOrigin;
                } catch (e) {}
            }
        } else {
            details.requestHeaders['Sec-Fetch-Dest'] = 'document';
            details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
            details.requestHeaders['Sec-Fetch-Site'] = 'none';
            details.requestHeaders['Sec-Fetch-User'] = '?1';
            details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
        }
        
        // Strip out Electron/Node specific headers if they sneak in
        delete details.requestHeaders['sec-ch-ua'];
        
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    // Strip CORS headers from responses to allow the video player to access the streams
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        
        if (details.url.includes('.m3u8') || details.url.includes('.mp4') || details.url.includes('.ts')) {
            responseHeaders['Access-Control-Allow-Origin'] = ['*'];
            responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
            responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        }

        callback({ cancel: false, responseHeaders: responseHeaders });
    });

    createWindow();

    // Hook into the network stack to sniff out m3u8 and mp4 streams AND block ads
    session.defaultSession.webRequest.onBeforeRequest({
        urls: ['<all_urls>'] // Listen to everything to block ads and sniff streams
    }, (details, callback) => {
        
        // 1. Check against the AdBlocker list
        const isAd = AD_DOMAINS.some(domain => {
            // Convert wildcard domain to regex
            const regexStr = '^' + domain.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$';
            const regex = new RegExp(regexStr, 'i');
            return regex.test(details.url);
        });

        if (isAd) {
            // Drop the connection immediately
            return callback({ cancel: true });
        }

        // 2. Sniff for video streams (only intercept if it's from the extraction window, not the main window player)
        if (extractionWindow && !extractionWindow.isDestroyed() && details.webContentsId === extractionWindow.webContents.id) {
            if (details.url.includes('.m3u8') || details.url.includes('.mp4')) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Pipe the intercepted URL back to the renderer
                    mainWindow.webContents.send('stream-intercepted', details.url);
                }
            }
        }
        
        // Let legitimate requests pass
        callback({ cancel: false });
    });
});

ipcMain.on('launch-extractor', (event, targetUrl) => {
    currentTargetUrl = targetUrl; // Save the target URL for referer spoofing
    
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