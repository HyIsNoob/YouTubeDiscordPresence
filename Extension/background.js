/*
Copyright (c) 2022–Present Michael Ren
Licensing and distribution info can be found at the GitHub repository
https://github.com/XFG16/YouTubeDiscordPresence
*/

// MAIN VARIABLE INITIALIZATION

const LOGGING = true;

const NMF = Object.freeze({ // NMF = NATIVE_MESSAGE_FORMAT (FOR HANDLING BY YTDPwin.exe)
    TITLE: ":TITLE001:",
    AUTHOR: ":AUTHOR002:",
    TIME_LEFT: ":TIMELEFT003:",
    END: ":END004:",
    IDLE: "#*IDLE*#"
});

let NORMAL_MESSAGE_DELAY = 1000;
const LIVESTREAM_TIME_ID = -1;
const UPDATE_PRESENCE_MESSAGE = "UPDATE_PRESENCE_DATA";
const REQUIRED_NATIVE_VERSION = "1.4.2";
let nativeRetryDelay = 1000;
let nativeRetryMaxDelay = 30000;
const LABELS = {
    en: {
        listenAlong: "Listen Along",
        watchLivestream: "Watch Livestream",
        watchVideo: "Watch Video",
        viewChannel: "View Channel",
        by: "by",
        liveOn: "[LIVE] on"
    },
    vi: {
        listenAlong: "Nghe cùng",
        watchLivestream: "Xem livestream",
        watchVideo: "Xem video",
        viewChannel: "Xem kênh",
        by: "bởi",
        liveOn: "[LIVE] trên"
    }
};
let lastPresenceSent = 0;

let nativeVersionStatus = -2;
let currentMessage = new Object();
let previousMessage = new Object();
let lastUpdated = 9007199254740991;
let isIdle = true;

let settings = {
    enabled: true,
    enableOnStartup: true,
    tabEnabledList: new Object(),

    enableExclusions: false,
    videoExclusionsList: new Array(),
    keywordExclusionsList: new Array(),

    enableInclusions: false,
    videoInclusionsList: new Array(),
    keywordInclusionsList: new Array(),

    enableYouTube: true,
    enableYouTubeMusic: true,
    enableVideoButton: true,
    enableChannelButton: true,
    enablePlayingIcon: true,
    addByAuthor: true,
    useAlbumThumbnail: true,
    useThumbnailIcon: false
}

// MUST RUN EVERY TIME BACKGROUND.JS STARTS - INITIALIZES KEYS JUST IN CASE THEY WEREN'T INITIALIZED BEFORE
// isNativeConnected is saved separately

for (const key of Object.keys(settings)) {
    chrome.storage.sync.get(key, function (result) {
        if (result[key] == undefined) {
            saveStorageKey(key, settings[key]);
        }
        else {
            settings[key] = result[key];
        }
    });
}

// VERSION COMPARER (REFERENCE: https://gist.github.com/TheDistantSea/8021359)

function versionCompare(v1, v2, options) { // CHECKS IF V1 IS GREATER THAN (1), EQUAL (0), OR LESS THAN V2 (-1)
    var lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

// NODE.JS APPLICATION HANDLER

const handleNativeMessage = (message) => {
    if (LOGGING && message.data) {
        console.log(`Received from application:\n    ${message.data}`);
    }
    else if (message.nativeVersion) {
        nativeVersionStatus = versionCompare(message.nativeVersion, REQUIRED_NATIVE_VERSION);
        saveStorageKey("nativeVersionStatus", nativeVersionStatus);
    }
    else if (LOGGING) {
        console.log(`Unknown application message:\n   ${message}`);
    }
}

// CONNECTING TO DESKTOP APP

let isNativeConnected = false;
let nativePort = {};

function assertNativeExistence(callback = null) {
    if (!isNativeConnected) {
        if (nativePort.disconnect) nativePort.disconnect();
        nativePort = chrome.runtime.connectNative("com.ytdp.discord.presence");

        isNativeConnected = true;
        nativePort.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                isNativeConnected = false;
                saveStorageKey("isNativeConnected", false);
                if (LOGGING) console.log("Native host disconnected");
                setTimeout(() => {
                    if (!isNativeConnected) {
                        assertNativeExistence();
                        nativeRetryDelay = Math.min(nativeRetryDelay * 2, nativeRetryMaxDelay);
                    }
                }, nativeRetryDelay);
            }
        });

        setTimeout(() => {
            if (isNativeConnected) {
                saveStorageKey("isNativeConnected", true);
                nativePort.onMessage.addListener(handleNativeMessage);
                nativeRetryDelay = 1000;
                if (callback) callback();
            }
        }, 1000);
    }
    else if (callback) {
        callback();
    }
}

assertNativeExistence(() => {
    nativePort.postMessage({ getNativeVersion: true });
    setTimeout(() => {
        if (nativeVersionStatus == -2) saveStorageKey("nativeVersionStatus", -1);
    }, 1000);
});
setInterval(() => {
    assertNativeExistence();
}, 3000);

// STORAGE SAVING HANDLER

function saveStorageKey(key, value) {
    let saveObject = new Object();
    saveObject[key] = value;
    chrome.storage.sync.set(saveObject);
}

function getLabel(key) {
    const lang = (navigator.language || "en").toLowerCase();
    if (lang.startsWith("vi") && LABELS.vi[key]) return LABELS.vi[key];
    return LABELS.en[key] || key;
}

function getStateText(isLive) {
    const author = currentMessage.author || "";
    if (isLive) {
        return settings.addByAuthor ? `${getLabel("liveOn")} ${author}` : author;
    }
    return settings.addByAuthor ? `${getLabel("by")} ${author}` : author;
}

// PARSE YOUTUBE URLS (https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url)

function getVideoId(url) {
    let regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    let match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : null;
}

// CHECK WHETHER OR NOT VIDEO/CHANNEL TITLE OR VIDEO ID IS EXCLUDED

function isExcluded(title, author, videoUrl) {
    if (settings.enableExclusions == false) {
        return false;
    }
    for (let i = 0; i < settings.videoExclusionsList.length; ++i) {
        excludedVideoId = getVideoId(settings.videoExclusionsList[i]);
        if (excludedVideoId && getVideoId(videoUrl) == excludedVideoId) {
            return true;
        }
        if (title == settings.videoExclusionsList[i] || author == settings.videoExclusionsList[i]) {
            return true;
        }
    }
    for (let i = 0; i < settings.keywordExclusionsList.length; ++i) {
        let keyword = settings.keywordExclusionsList[i].toLowerCase();
        if (title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword)) {
            return true;
        }
    }
    return false;
}

// CHECK WHETHER OR NOT VIDEO/CHANNEL TITLE OR VIDEO ID IS INCLUDED

function isIncluded(title, author, videoId) {
    if (settings.enableInclusions == false) {
        return true;
    }
    for (let i = 0; i < settings.videoInclusionsList.length; ++i) {
        includedVideoId = getVideoId(settings.videoInclusionsList[i]);
        if (includedVideoId && videoId == includedVideoId) {
            return true;
        }
        if (title == settings.videoInclusionsList[i] || author == settings.videoInclusionsList[i]) {
            return true;
        }
    }
    for (let i = 0; i < settings.keywordInclusionsList.length; ++i) {
        let keyword = settings.keywordInclusionsList[i].toLowerCase();
        if (title.toLowerCase().includes(keyword) || author.toLowerCase().includes(keyword)) {
            return true;
        }
    }
    return false;
}

// STORAGE INITIALIZER WHEN CHROME IS OPENED

chrome.runtime.onStartup.addListener(function () {
    chrome.storage.sync.get("enableOnStartup", function (result) {
        saveStorageKey("enableOnStartup", result.enableOnStartup == undefined || result.enableOnStartup == true);
        saveStorageKey("enabled", result.enableOnStartup == undefined || result.enableOnStartup == true);
        settings.enabled = (result.enableOnStartup == undefined || result.enableOnStartup == true);
    });
    saveStorageKey("tabEnabledList", new Object());
    settings.tabEnabledList = new Object();
});

// REMOVE ENABLEONTHISTAB WHEN TAB IS CLOSED

chrome.tabs.onRemoved.addListener(function (tab) {
    chrome.storage.sync.get("tabEnabledList", function (result) {
        let newTabEnabledList = result.tabEnabledList;
        if (tab in newTabEnabledList) {
            delete newTabEnabledList[tab];
        }
        saveStorageKey("tabEnabledList", newTabEnabledList);
    });
});

// DETECT CHANGE IN ENABLED SETTING

chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (LOGGING) {
            console.log("the key {", key, "} has been changed from", oldValue, "to", newValue)
        }
        settings[key] = newValue;
    }
});

// LISTENER FOR DATA FROM CONTENT_LOADER.JS
// SELECTION ON WHICH TAB TO DISPLAY IS BASED ON WHICH ONE IS LOADED FIRST BY SETTING CURRENTMESSAGE.SCRIPTID TO NULL

function isApplicationTypeEnabled(applicationType) {
    if (applicationType == "youtube") {
        return settings.enableYouTube;
    }
    else {
        return settings.enableYouTubeMusic;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.messageType == UPDATE_PRESENCE_MESSAGE && (sender.tab.id == currentMessage.scriptId || currentMessage.scriptId == null) && !isExcluded(message.title, message.author, message.videoId) && isIncluded(message.title, message.author, message.videoId) && isApplicationTypeEnabled(message.applicationType)) {
        if (!(sender.tab.id in settings.tabEnabledList)) {
            settings.tabEnabledList[sender.tab.id] = true;
        }
        if (settings.tabEnabledList[sender.tab.id]) {
            currentMessage.scriptId = sender.tab.id;
            currentMessage.title = message.title;
            currentMessage.author = message.author;
            currentMessage.timeLeft = message.timeLeft;
            currentMessage.duration = message.duration;
            currentMessage.videoId = message.videoId;
            currentMessage.videoUrl = "https://youtube.com/watch?v=" + message.videoId;
            currentMessage.channelUrl = message.channelUrl;
            currentMessage.applicationType = message.applicationType;
            currentMessage.thumbnailUrl = message.thumbnailUrl;
            lastUpdated = new Date().getTime();
            if (LOGGING) console.log("Channel URL:", message.channelUrl);
            sendResponse(null);
        }
    }
    return true;
});

// NATIVE MESSAGING HANDLER

const IDLE_DATA_OBJECT = {
    cppData: NMF.TITLE + NMF.IDLE + NMF.AUTHOR + NMF.IDLE + NMF.TIME_LEFT + NMF.IDLE + NMF.END,
    jsTitle: NMF.IDLE,
    presenceData: NMF.IDLE
};

function idleCallback() {
    if (LOGGING) console.log("Idle data sent:\n    #*IDLE*#");
    nativePort.postMessage(IDLE_DATA_OBJECT);

    currentMessage.scriptId = null;
    previousMessage = {};
    isIdle = true;
}

// FOR 1.5.2 OR ABOVE, ALL PRESENCE DATA WILL BE HANDLED AND SENT IN THE EXTENSION UNDER presenceData. OTHER OBJECT KEY PAIRS ARE FOR BACKWARDS COMPATIBILITY

function generatePresenceData() {
    let stateData = "";
    let activityType = 3; // Activity: Watching
    const isLive = currentMessage.timeLeft == LIVESTREAM_TIME_ID;
    stateData = getStateText(isLive);

    const validThumbnail = currentMessage.thumbnailUrl && currentMessage.thumbnailUrl.startsWith("http");

    let assetsData = {
        large_image: "youtube3",
        large_text: currentMessage.title.substring(0, 128)
    };
    if (currentMessage.applicationType == "youtubeMusic") {
        activityType = 2; // Activity: Listening
        if (currentMessage.thumbnailUrl && currentMessage.thumbnailUrl.startsWith("https://lh3.googleusercontent.com/") && settings.useAlbumThumbnail) {
            assetsData.large_image = currentMessage.thumbnailUrl; // album art (square), preferred when available
        }
        else if (currentMessage.thumbnailUrl) {
            assetsData.large_image = currentMessage.thumbnailUrl; // fallback to track video thumbnail even if not album art
        }
        else {
            assetsData.large_image = "youtube-music";
        }
    }
    else {
            activityType = 3; // Activity: Watching
        if (validThumbnail) {
            assetsData.large_image = currentMessage.thumbnailUrl;
        }
        else if (currentMessage.timeLeft == LIVESTREAM_TIME_ID) {
            assetsData.large_image = "youtubelive1";
        }
    }

    if (settings.enablePlayingIcon) {
        assetsData.small_image = "playing-icon-6";
        const authorText = (currentMessage.author || "").substring(0, 64);
        const baseText = currentMessage.applicationType == "youtubeMusic" ? "YouTube Music" : "YouTube";
        assetsData.small_text = currentMessage.timeLeft == LIVESTREAM_TIME_ID ? `[LIVE] ${authorText || baseText}` : (authorText || baseText);
    }

    let timeStampsData = {};
    if (currentMessage.timeLeft != LIVESTREAM_TIME_ID) {
        // timeStampsData.end = Date.now() + (currentMessage.timeLeft * 1000);
        
        // Changed to handle Discord UI/UX updates
        // For more info, visit https://github.com/XFG16/YouTubeDiscordPresence#announcements
        timeStampsData.start = Date.now() - ((currentMessage.duration - currentMessage.timeLeft) * 1000);
    }
    else {
        timeStampsData.start = Date.now();
    }

    let buttonsData = [];
    if (settings.enableVideoButton && currentMessage.videoUrl) {
        if (currentMessage.applicationType == "youtubeMusic") {
            buttonsData.push({
                label: getLabel("listenAlong"),
                url: currentMessage.videoUrl
            });
        }
        else if (currentMessage.timeLeft == LIVESTREAM_TIME_ID) {
            buttonsData.push({
                label: getLabel("watchLivestream"),
                url: currentMessage.videoUrl
            });
        }
        else {
            buttonsData.push({
                label: getLabel("watchVideo"),
                url: currentMessage.videoUrl
            });
        }
    }
    if (settings.enableChannelButton && currentMessage.channelUrl && currentMessage.channelUrl.startsWith("http") && !currentMessage.channelUrl.endsWith("undefined")) {
        buttonsData.push({
            label: getLabel("viewChannel"),
            url: currentMessage.channelUrl
        });
    }

    let presenceData = {
        details: isLive ? `[LIVE] ${currentMessage.title.substring(0, 124)}` : currentMessage.title.substring(0, 128),
        state: stateData.substring(0, 128),
        assets: assetsData,
        timestamps: timeStampsData,
        type: activityType,
    };
    if (buttonsData.length > 0) {
        presenceData.buttons = buttonsData;
    }

    return presenceData;
}

function updateCallback() {
    const now = Date.now();
    if (now - lastPresenceSent < 800) {
        return;
    }
    let dataObject = {
        cppData: NMF.TITLE + currentMessage.title + NMF.AUTHOR + currentMessage.author + NMF.TIME_LEFT + Math.round(currentMessage.timeLeft) + NMF.END,
        jsTitle: currentMessage.title,
        jsAuthor: currentMessage.author,
        jsTimeLeft: currentMessage.timeLeft,
        jsVideoUrl: currentMessage.videoUrl,
        jsChannelUrl: currentMessage.channelUrl,
        jsPresenceSettings: {
            enableVideoButton: settings.enableVideoButton,
            enableChannelButton: settings.enableChannelButton,
            enablePlayingIcon: settings.enablePlayingIcon,
            addByAuthor: settings.addByAuthor
        },
        jsApplicationType: currentMessage.applicationType,
        presenceData: generatePresenceData()

    };

    if (LOGGING) console.log("Presence data:", dataObject);
    nativePort.postMessage(dataObject);
    lastPresenceSent = now;
}

let pipeInterval = setInterval(function () {
    let inclusionExclusionStatus = false;
    if (!(Object.keys(currentMessage).length == 0) && (isExcluded(currentMessage.title, currentMessage.author, currentMessage.videoUrl) || !isIncluded(currentMessage.title, currentMessage.author, currentMessage.videoId))) {
        inclusionExclusionStatus = true;
    }
    let delaySinceUpdate = new Date().getTime() - lastUpdated;
    if (!settings.enabled || !(currentMessage.scriptId in settings.tabEnabledList) || delaySinceUpdate >= 3 * NORMAL_MESSAGE_DELAY || inclusionExclusionStatus) {
        if (!isIdle) {
            assertNativeExistence(idleCallback);
        }
        return;
    }
    if (delaySinceUpdate >= 2 * NORMAL_MESSAGE_DELAY) {
        currentMessage.scriptId = null;
    }

    let skipMessage = false;
    if (previousMessage.timeLeft >= currentMessage.timeLeft && ((1000 * (previousMessage.timeLeft - currentMessage.timeLeft) < 2 * NORMAL_MESSAGE_DELAY) || (previousMessage.timeLeft == LIVESTREAM_TIME_ID && currentMessage.timeLeft != LIVESTREAM_TIME_ID))) {
        skipMessage = true;
    }
    if (!(previousMessage.title == currentMessage.title && previousMessage.author == currentMessage.author && previousMessage.thumbnailUrl == currentMessage.thumbnailUrl && skipMessage)) {
        if (nativeVersionStatus < 0) {
            function getNativeVersion() {
                nativePort.postMessage({ getNativeVersion: true });
            }
            assertNativeExistence(getNativeVersion);
        }
        assertNativeExistence(updateCallback);
    }

    previousMessage.title = currentMessage.title;
    previousMessage.author = currentMessage.author;
    previousMessage.timeLeft = currentMessage.timeLeft;
    previousMessage.thumbnailUrl = currentMessage.thumbnailUrl;
    isIdle = false;
}, NORMAL_MESSAGE_DELAY);

// EXTENSION UPDATE HANDLER

chrome.runtime.onUpdateAvailable.addListener(function (details) {
    console.log(`YTDP IS updating to ${details.version}`);
    chrome.runtime.reload();
});

// OPEN INSTALLATION PAGE ON CHROME EXTENSION ADDED

chrome.runtime.onInstalled.addListener(function (install) {
    if (install.reason == chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({ url: "https://github.com/XFG16/YouTubeDiscordPresence/tree/main#installation" }, function (tab) {
            console.log("Redirected user to installation page at\nhttps://github.com/XFG16/YouTubeDiscordPresence/tree/main#installation");
        });
        saveStorageKey("flashEditPresence", true);
    }
});