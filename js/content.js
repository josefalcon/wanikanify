/**
 * WaniKanify - 2012/12/08 - 2015/08/09
 * Author: jose.e.falcon@gmail.com
 * Subauthor: todd.seiler@gmail.com
 */

// cache keys
var VOCAB_KEY      = "wanikanify_vocab";
var SRS_KEY        = "wanikanify_srs";
var API_KEY        = "wanikanify_apiKey";
var CUST_VOCAB_KEY = "wanikanify_customvocab";
var GOOG_VOCAB_KEY = "wanikanify_googleVocabKey";
var GOOG_VOCAB_META_KEY = "wanikanify_googleVocab_meta";
var AUDIO_KEY      = "wanikanify_audio";

// filter map
var FILTER_MAP = {
    "apprentice":  function(vocab) { return vocab.user_specific != null && vocab.user_specific.srs == "apprentice"; },
    "guru":        function(vocab) { return vocab.user_specific != null && vocab.user_specific.srs == "guru"; },
    "master":      function(vocab) { return vocab.user_specific != null && vocab.user_specific.srs == "master"; },
    "enlighten":   function(vocab) { return vocab.user_specific != null && vocab.user_specific.srs == "enlighten"; },
    "burned":      function(vocab) { return vocab.user_specific != null && vocab.user_specific.srs == "burned"; }
};

// ------------------------------------------------------------------------------------------------
// The main program driver.
// main : Object ->
function main(cache_local) {
    chrome.storage.sync.get([API_KEY, SRS_KEY, CUST_VOCAB_KEY, GOOG_VOCAB_META_KEY, AUDIO_KEY], async function(cache_sync) {
        var apiKey = cache_sync[API_KEY];
        if (!apiKey) {
            console.error("No API key provided! Please use the options page to specify your API key.");
        }
        var vocabDictionary = {};
        await importWaniKaniVocab(vocabDictionary, cache_sync, cache_local, apiKey);
        console.log("Total entries from WaniKani: " + Object.keys(vocabDictionary).length);
        importGoogleVocab(vocabDictionary, cache_local, cache_sync);
        console.log("Total entries after Google Spreadsheets: " + Object.keys(vocabDictionary).length);
        importCustomVocab(vocabDictionary, cache_local, cache_sync);
        console.log("Total entries after CustomVocab: " + Object.keys(vocabDictionary).length);
        var dictionaryCallback = buildDictionaryCallback(
            cache_local,
            cache_sync,
            vocabDictionary,
            cache_local.wanikanify_vocab,
            cache_local.wanikanify_googleVocabKey,
            cache_sync.wanikanify_customvocab);

        $("body *:not(noscript):not(script):not(style)").replaceText(/\b(\S+?)\b/g, dictionaryCallback);
    });
}

// ------------------------------------------------------------------------------------------------
async function importWaniKaniVocab(vocabDictionary, cache_sync, cache_local, apiKey) {
    var waniKaniVocabList = await tryCacheOrWaniKani(cache_local, apiKey);
    if (waniKaniVocabList && waniKaniVocabList.length > 0) {
        var filteredList = filterVocabList(waniKaniVocabList, getFilters(cache_sync));
        var d = toDictionary(filteredList);
        // This could be slow...
        for (key in d) {
            vocabDictionary[key] = d[key];
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Dump in the custom vocabulary words, overriding the wanikani entries.
function importCustomVocab(vocabDictionary, cache_local, cache_sync) {
    var ENTRY_DELIM = "\n";
    var ENG_JAP_COMBO_DELIM = ";";
    var ENG_VOCAB_DELIM = ",";
    var customVocab = cache_sync[CUST_VOCAB_KEY];
    if (!customVocab || customVocab.length == 0) {
        return;
    }

    // Explode entire list into sets of englishwords and japanese combinations.
    var splitList = customVocab.split(ENTRY_DELIM);
    if (!splitList) {
        return;
    }
    for (var i = 0; i < splitList.length; ++i) {
        // Explode each entry into english words and Kanji.
        var splitEntry = splitList[i].split(ENG_JAP_COMBO_DELIM);
        if (!splitEntry) {
            continue;
        }
        var untrimmedSplitEntry = splitEntry[1];
        if (untrimmedSplitEntry) {
            var kanjiVocabWord = untrimmedSplitEntry.trim();
            for (var j = 0; j < splitEntry.length; ++j) {
                var splitEnglishWords = splitEntry[0].split(ENG_VOCAB_DELIM);
                if (!splitEnglishWords) {
                    continue;
                }
                for (var k = 0; k < splitEnglishWords.length; ++k) {
                    // If it already exists, it gets replaced.
                    var engWordUntrimmed = splitEnglishWords[k];
                    if (engWordUntrimmed) {
                        var engVocabWord = engWordUntrimmed.trim();
                        vocabDictionary[engVocabWord] = kanjiVocabWord;
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Get the correct delimeter for this sheet/key combo.
function getDelim(meta_data_collection, spreadsheet_collection_key, sheet_name) {
    for (var i = 0; i < meta_data_collection.length; ++i) {
        if (meta_data_collection[i].spreadsheet_collection_key == spreadsheet_collection_key &&
            meta_data_collection[i].sheet_name == sheet_name) {
                return meta_data_collection[i].delim;
        }
    }
    console.error("Could not find key/sheet combo in metadata for: " + spreadsheet_collection_key + " " + sheet_name);
    return ",";
}

// ------------------------------------------------------------------------------------------------
function importGoogleVocab(vocabDictionary, cache_local, cache_sync) {
    var googleVocab = cache_local[GOOG_VOCAB_KEY];
    if (!googleVocab || googleVocab.collections.length == 0) {
        return;
    }

    var metaData = cache_sync[GOOG_VOCAB_META_KEY];
    if (!metaData) {
        return;
    }

    // We have multiple collections.
    // Each collection can contain multiple sheets.
    // Each sheet contains multiple entries of english words -> japanese mappings.
    // Each entry needs to be split up into multiple synonyms.
    var collections = googleVocab.collections;
    // For each collection.
    for (spreadsheet_collection_key in collections) {
        var sheets = collections[spreadsheet_collection_key];
        // For each sheet in that collection.
        for (sheet_name in sheets) {
            var delim = getDelim(metaData["meta_data_collection"], spreadsheet_collection_key, sheet_name);
            // For each entry in that sheet.
            for (var i = 0; i < sheets[sheet_name].length; ++i) {
                var entry = sheets[sheet_name][i];
                var splitEnglishWords = entry.eng.split(delim);
                // For each english synonym.
                for (k = 0; k < splitEnglishWords.length; k++) {
                    var eng_word = splitEnglishWords[k].trim();
                    var jap_word = entry.jap.trim();
                    if (eng_word.length == 0 || jap_word.length == 0)
                        continue;
                    vocabDictionary[eng_word] = jap_word;
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Returns the filters to use for vocab filtering
// getFilters: Object -> [Function]
function getFilters(cache_sync) {
    var options = cache_sync[SRS_KEY];
    if (options) {
        return filters = options.map(function(obj, index) {
            return FILTER_MAP[obj];
        });
    }
    return [];
}

// ------------------------------------------------------------------------------------------------
// Returns a dictionary from String -> String.
// tryCacheOrWaniKani : Object, String -> Object
async function tryCacheOrWaniKani(cache_local, apiKey) {
    // returns true if the given date is over an hour old.
    function isExpired(date) {
        var then = new Date(date);
        var now = new Date();
        return (Math.abs(now - then) > 3600000);
    }

    var hit = cache_local[VOCAB_KEY];
    if (hit && hit.vocabList) {
        if (!hit.inserted || isExpired(hit.inserted)) {
            await tryWaniKani(apiKey);
        }
        return hit.vocabList;
    }

    var waniKaniList = await tryWaniKani(apiKey);
    return waniKaniList;
}

// ------------------------------------------------------------------------------------------------
// Returns a [Object] of vocabulary words from WaniKani
// tryWaniKani : String -> [Object]
async function tryWaniKani(apiKey) {
    if (!apiKey) {
        console.error("No API key provided! Please use the options page to specify your API key.");
        return [];
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "fetchVocab" }, (vocabList) => {
            const error = chrome.runtime.lastError;
            if (error) {
                console.error(error.message);
                reject(error);
            } else {
                console.log(vocabList);
                resolve(vocabList);
            }
        });
    });
}

// ------------------------------------------------------------------------------------------------
// Caches a given [Object] of vocabulary words with an inserted date
// cacheVocabList: [Object] ->
function cacheVocabList(vocabList) {
    var obj = {};
    obj[VOCAB_KEY] = {
        "inserted": (new Date()).toJSON(),
        "vocabList": vocabList
    };

    chrome.storage.local.set(obj);
}

// ------------------------------------------------------------------------------------------------
// Filters the given [Object] of vocabulary words with the given list of filters.
// filterVocabList : [Object], [Function] -> [Object]
function filterVocabList(vocabList, filters) {
    return vocabList.filter(function(obj) {
        for (var i = 0; i < filters.length; i++) {
            if (filters[i](obj)) {
                return true;
            }
        }
        return false;
    });
}

// ------------------------------------------------------------------------------------------------
// Converts a list of vocab words to a dictionary.
// toDictionary : [Object] -> Object
function toDictionary(vocabList) {
    var vocab = {};
    $.each(vocabList, function(index, value) {
        var character = value.character;
        var values = value.meaning.split(", ");
        for (var i = 0; i < values.length; i++) {
            vocab[values[i]] = character;
        }
        var user_synonyms = value.user_specific.user_synonyms;
        if (user_synonyms) {
            for (var i = 0; i < user_synonyms.length; i++) {
                vocab[user_synonyms[i]] = character;
            }
        }
    });
    return vocab;
}

// ------------------------------------------------------------------------------------------------
function getReading(wanikani_vocab_list, googleVocab, custom_vocab_list, vocab_to_find) {
    // Search custom vocab for the reading.
    // FIX: Make this global.
    var ENTRY_DELIM = "\n";
    var ENG_JAP_COMBO_DELIM = ";";
    var ENG_VOCAB_DELIM = ",";
    if (custom_vocab_list && custom_vocab_list.length != 0) {
        // Explode entire list into sets of englishwords and japanese combinations.
        var splitList = custom_vocab_list.split(ENTRY_DELIM);
        if (splitList) {
            for (var i = 0; i < splitList.length; ++i) {
                // Explode each entry into english words and Kanji.
                var splitEntry = splitList[i].split(ENG_JAP_COMBO_DELIM);
                if (splitEntry) {
                    var untrimmedSplitEntry = splitEntry[1];
                    if (untrimmedSplitEntry) {
                        var kanjiVocabWord = untrimmedSplitEntry.trim();
                        if (kanjiVocabWord == vocab_to_find) {
                            var reading = splitEntry[2];
                            if (reading) {
                                return reading.trim();
                            } else {
                                return kanjiVocabWord;
                            }
                        }
                    }
                }
            }
        }
    }

    // Search google spreadsheets for the reading.
    // We have multiple collections.
    // Each collection can contain multiple sheets.
    // Each sheet contains multiple entries of english words -> japanese mappings.
    // Each entry needs to be split up into multiple synonyms.
    var collections = googleVocab;
    // For each collection.
    for (spreadsheet_collection_key in collections) {
        var sheets = collections[spreadsheet_collection_key];
        // For each sheet in that collection.
        for (sheet_name in sheets) {
            // For each entry in that sheet.
            for (var i = 0; i < sheets[sheet_name].length; ++i) {
                var entry = sheets[sheet_name][i];
                var japanese_word = entry.jap;
                if (japanese_word == vocab_to_find) {
                    return entry.jap_reading;
                }
            }
        }
    }

    // Search wanikani for the reading.
    for (var i = 0; i < wanikani_vocab_list.length; ++i) {
        if (wanikani_vocab_list[i].character == vocab_to_find) {
            return wanikani_vocab_list[i].kana;
        }
    }
    return vocab_to_find;
}

// ------------------------------------------------------------------------------------------------
function fetchWaniKaniAudioURL(reading) {
    return "";
}

// ------------------------------------------------------------------------------------------------
function buildAudioUrl(kanji, reading) {
    if (!kanji)
        return "";

    var url = {};
    if (!reading) {
        url = kanji;
    } else {
        url = fetchWaniKaniAudioURL(reading);
        if (!url) {
            url = reading;
        }
    }
    return url;
}

// ------------------------------------------------------------------------------------------------
// Creates a closure on the given dictionary.
// buildDictionaryCallback : Object -> (function(String) -> String)
function buildDictionaryCallback(
    cache_local,
    cache_sync,
    vocabDictionary,
    wanikani_vocab_list,
    google_collections,
    custom_vocab) {

    var audio_settings = cache_sync[AUDIO_KEY];
    var audio_on = true;
    var audio_on_click = false;
    if (audio_settings) {
        audio_on = audio_settings.on;
        audio_on_click = audio_settings.clicked;
    }

    var wk_vocab_list = {};
    if (wanikani_vocab_list) {
        wk_vocab_list = wanikani_vocab_list.vocabList;
    }
    var gc = {};
    if (google_collections) {
        gc = google_collections.collections;
    }

    return function(str) {
        var kanji = vocabDictionary[str.toLowerCase()];
        if (!kanji)
            return str;
        var reading = getReading(wk_vocab_list, gc, custom_vocab, kanji);
        var url = buildAudioUrl(kanji, reading);
        if (!url)
            return str;


        // FIX: Lots of duplication here.
        if (audio_on) {
            if (audio_on_click) {
                return '<span class="wanikanified" title="' + str + '" data-en="' + str + '" data-jp="' + kanji +
                    '" onClick="var msg = new SpeechSynthesisUtterance(); msg.text = \'' + url + '\'; msg.lang = \'ja-JP\';window.speechSynthesis.speak(msg); var t = this.getAttribute(\'title\'); this.setAttribute(\'title\', this.innerHTML); this.innerHTML = t;">' + kanji + '<\/span>';
            } else {
                return '<span class="wanikanified" title="' + str + '" data-en="' + str + '" data-jp="' + kanji +
                    '" onmouseover="timer1=setTimeout(function(){var msg = new SpeechSynthesisUtterance(); msg.text = \'' + url + '\'; msg.lang = \'ja-JP\';window.speechSynthesis.speak(msg);}, 700);" onmouseout="clearTimeout(timer1);" onClick="var t = this.getAttribute(\'title\'); this.setAttribute(\'title\', this.innerHTML); this.innerHTML = t;">' + kanji + '<\/span>';
            }
        }
        else {
                return '<span class="wanikanified" title="' + str + '" data-en="' + str + '" data-jp="' + kanji +
                    '" onClick="var t = this.getAttribute(\'title\'); this.setAttribute(\'title\', this.innerHTML); this.innerHTML = t;">' + kanji + '<\/span>';
        }
    }
}

// kick off the program
chrome.storage.local.get([VOCAB_KEY, GOOG_VOCAB_KEY], main);
