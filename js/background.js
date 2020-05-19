/**
 * WaniKanify - 2012/12/08 - 2015/08/09
 * Author: jose.e.falcon@gmail.com
 * Subauthor: todd.seiler@gmail.com
 */

var executed = {}

// Injects JS into the tab.
// executeScripts : Object ->
function executeScripts(tab) {
    chrome.tabs.get(tab, function(details) {
        chrome.storage.sync.get(['wanikanify_blackList'], function(items) {

            function isBlackListed(details, items) {
                var url = details.url;
                var blackList = items.wanikanify_blackList;
                if (blackList) {
                    if (blackList.length == 0) {
                        return false;
                    } else {
                        var matcher = new RegExp($.map(items.wanikanify_blackList, function(val) { return '('+val+')';}).join('|'));
                        return matcher.test(url);
                    }
                }
                return false;
            }


            if (!isBlackListed(details, items)) {
                chrome.tabs.executeScript(null, { file: "js/jquery.js" }, function() {
                    chrome.tabs.executeScript(null, { file: "js/replaceText.js" }, function() {
                        chrome.tabs.executeScript(null, { file: "js/content.js" }, function() {
                            executed[tab] = "jp";
                        });
                    });
                });
            } else {
                console.log("Blacklisted");
            }
        });
    });
}

// Removes the executed status from the map on loads.
// clearStatus : Object ->
function clearStatus(tab, change) {
    if (change.status === 'complete') {
        delete executed[tab];
    }
}

// Named function for adding/removing the callback
// loadOnUpdated : Object, String ->
function loadOnUpdated(tab, change) {
    if (change.status === 'complete') {
        delete executed[tab];
        executeScripts(tab);
    }
}

// Toggles the 'wanikanified' elements already on the page.
// setLanguage : String ->
function setLanguage(lang) {
    var inner = "data-" + lang;
    var title = "data-" + (lang == "jp" ? "en" : "jp");
    chrome.tabs.executeScript(null,
        {code:"$(\".wanikanified\").each(function(index, value) { value.innerHTML = value.getAttribute('" + inner + "'); value.title = value.getAttribute('" + title + "'); })"});
}

// Function for handling browser button clicks.
// buttonClicked : Object ->
function buttonClicked(tab) {
    var lang = executed[tab.id];
    if (lang) {
        lang = (lang == "jp" ? "en" : "jp");
        executed[tab.id] = lang;
        setLanguage(lang);
    } else {
        executeScripts(tab.id);
    }
}

async function getApiKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(["wanikanify_apiKey"], (items) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(items.wanikanify_apiKey);
            }
        });
    });
}

async function repeatPaginatedRequest(url, apiKey) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const response = await fetch(url, { headers });
    const json = await response.json();

    let result = json.data;
    if (json.pages.next_url) result = result.concat(await repeatPaginatedRequest(json.pages.next_url, apiKey));

    return result;
}

async function getVocabListFromWaniKani(apiKey) {
    // Request all user vocabulary assignments: https://docs.api.wanikani.com/20170710/#get-all-assignments
    const assignments = await repeatPaginatedRequest('https://api.wanikani.com/v2/assignments?subject_types=vocabulary', apiKey);

    // Request all study materials to find out about meaning synonyms: https://docs.api.wanikani.com/20170710/#study-materials
    const studyMaterials = await repeatPaginatedRequest('https://api.wanikani.com/v2/study_materials?subject_types=vocabulary', apiKey);

    // Create a map from the user's assignment subjects to a list of data that we need
    const progress = assignments.reduce((list, assignment) => {
        material = studyMaterials.find((material) => material.data.subject_id == assignment.data.subject_id);

        list[assignment.data.subject_id] = {
            srs_stage: assignment.data.srs_stage,
            synonyms: material ? material.data.meaning_synonyms : [],
        };
        return list;
    }, {});

    // Request all vocabulary subjects the user has already learned: https://docs.api.wanikani.com/20170710/#get-all-subjects
    const subjectIdList = Object.keys(progress).join(',');
    const subjects = await repeatPaginatedRequest(`https://api.wanikani.com/v2/subjects?types=vocabulary&ids=${subjectIdList}`, apiKey);
    
    // Augment the subjects by adding the user's current SRS progress
    return subjects.map((subject) => {
        subject.data = { ...subject.data, ...progress[subject.id] };
        return subject;
    });
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.type === 'fetchVocab') {
            getApiKey()
                .then(getVocabListFromWaniKani)
                .then(sendResponse);
            return true;
        }
    }
);

// Always execute scripts when the action is clicked.
chrome.browserAction.onClicked.addListener(buttonClicked);

// Always listen for loads or reloads to clear from the cache
chrome.tabs.onUpdated.addListener(clearStatus);

// Add a listener for storage changes. We may need to disable "auto" running.
chrome.storage.onChanged.addListener(function(changes, store) {
    var load = changes.wanikanify_runOn;
    if (load) {
        if (load.newValue == "onUpdated") {
            chrome.tabs.onUpdated.addListener(loadOnUpdated);
        } else {
            chrome.tabs.onUpdated.removeListener(loadOnUpdated);
        }
    }
});

function toggleAutoLoad(info, tab) {
    chrome.storage.sync.get("wanikanify_runOn", function(items) {
        var load = items.wanikanify_runOn;
        var flip = (load == "onUpdated") ? "onClick" : "onUpdated";
        chrome.storage.sync.set({"wanikanify_runOn":flip}, function() {
            var title = (flip == "onClick") ? "Enable autoload" : "Disable autoload";
            chrome.contextMenus.update("wanikanify_context_menu", {title:title});
        });
    });
}

// Check the storage. We may already be in "auto" mode.
chrome.storage.sync.get(["wanikanify_runOn","wanikanify_apiKey"], function(items) {
    var context = {
        id: "wanikanify_context_menu",
        contexts: ["all"],
        onclick: toggleAutoLoad
    };

    var load = items.wanikanify_runOn;
    if (load == "onUpdated") {
        chrome.tabs.onUpdated.addListener(loadOnUpdated);
        context.title = "Disable autoload";
    } else {
        context.title = "Enable autoload";
    }
    chrome.contextMenus.create(context);

    if (!items.wanikanify_apiKey) {
        chrome.browserAction.setPopup({popup:"popup.html"});
    }
});
