/**
 * WaniKanify - 2012/12/08
 * Author: jose.e.falcon@gmail.com
 */

// cache keys
var VOCAB_KEY      = "wanikanify_vocab";
var SRS_KEY        = "wanikanify_srs";
var API_KEY        = "wanikanify_apiKey";
var CUST_VOCAB_KEY = "wanikanify_customvocab";
var GOOG_VOCAB_KEY = "wanikanify_googleVocabKey"
var GOOG_VOCAB_META_KEY = "wanikanify_googleVocab_meta"

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
function main(cache) {
    var apiKey = cache[API_KEY];
    if (!apiKey) {
        console.error("No API key provided! Please use the options page to specify your API key.");
    }

    var vocabDictionary = {};
    importWaniKaniVocab(vocabDictionary, cache, apiKey);
    console.log("Total entries from WaniKani: " + Object.keys(vocabDictionary).length);
    importCustomVocab(vocabDictionary, cache);
    console.log("Total entries after CustomVocab: " + Object.keys(vocabDictionary).length);
    importGoogleVocab(vocabDictionary, cache);
    console.log("Total entries after Google Spreadsheets: " + Object.keys(vocabDictionary).length);
    var dictionaryCallback = buildDictionaryCallback(vocabDictionary);

    $("body *:not(noscript):not(script):not(style)").replaceText(/\b(\S+?)\b/g, dictionaryCallback);
}

// ------------------------------------------------------------------------------------------------
function importWaniKaniVocab(vocabDictionary, cache, apiKey) {
    var waniKaniVocabList = tryCacheOrWaniKani(cache, apiKey);
    if (waniKaniVocabList && waniKaniVocabList.length > 0) {
        var filteredList = filterVocabList(waniKaniVocabList, getFilters(cache));
        var d = toDictionary(filteredList);
        // This could be slow...
        for (key in d) {
            vocabDictionary[key] = d[key];
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Dump in the custom vocabulary words, overriding the wanikani entries.
function importCustomVocab(vocabDictionary, cache) {
    var ENTRY_DELIM = "\n";
    var ENG_JAP_COMBO_DELIM = ";";
    var ENG_VOCAB_DELIM = ",";
    var customVocab = cache[CUST_VOCAB_KEY];
    if (!customVocab || customVocab.length == 0) {
        return;
    }

    // Explode entire list into sets of englishwords and japanese combinations.
    var splitList = customVocab.split(ENTRY_DELIM);
    for (var i = 0; i < splitList.length; ++i) {
        // Explode each entry into english words and Kanji.
        var splitEntry = splitList[i].split(ENG_JAP_COMBO_DELIM);
        var kanjiVocabWord = splitEntry[1].trim();
        for (var j = 0; j < splitEntry.length; ++j) {
            var splitEnglishWords = splitEntry[0].split(ENG_VOCAB_DELIM);
            for (var k = 0; k < splitEnglishWords.length; ++k) {
                // If it already exists, it gets replaced.
                var engVocabWord = splitEnglishWords[k].trim();
                vocabDictionary[engVocabWord] = kanjiVocabWord;
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
function importGoogleVocab(vocabDictionary, cache) {
    var googleVocab = cache[GOOG_VOCAB_KEY];
    if (!googleVocab || googleVocab.collections.length == 0) {
        return;
    }

    var metaData = cache[GOOG_VOCAB_META_KEY];
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
function getFilters(cache) {
    var options = cache[SRS_KEY];
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
function tryCacheOrWaniKani(cache, apiKey) {
    // returns true if the given date is over an hour old.
    function isExpired(date) {
        var then = new Date(date);
        var now = new Date();
        return (Math.abs(now - then) > 3600000);
    }

    var hit = cache[VOCAB_KEY];
    if (hit && hit.vocabList) {
        if (!hit.inserted || isExpired(hit.inserted)) {
            tryWaniKani(apiKey, true);
        }
        return hit.vocabList;
    }

    var waniKaniList = tryWaniKani(apiKey, false);
    return waniKaniList;
}

// ------------------------------------------------------------------------------------------------
// Returns a [Object] of vocabulary words from WaniKani
// tryWaniKani : String, Boolean -> [Object]
function tryWaniKani(apiKey, async) {
    if (!apiKey) {
        console.error("No API key provided! Please use the options page to specify your API key.");
        return [];
    }

    var info;
    $.ajax({
        async: async,
        accepts: "application/json",
        type: "GET",
        url: "https://www.wanikani.com/api/v1.2/user/"+apiKey+"/vocabulary",
    }).done(function (response) {
        if (response.error) {
            console.error("Vocabulary request failed.");
            info = [];
        } else {
            info = response.requested_information.general;
            cacheVocabList(info);
        }
    }).fail(function (response) {
        console.error("Vocabulary request failed.");
        info = [];
    });
    return info;
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
// Creates a closure on the given dictionary.
// buildDictionaryCallback : Object -> (function(String) -> String)
function buildDictionaryCallback(vocabDictionary) {
    return function(str) {
        var translation = vocabDictionary[str.toLowerCase()];
        if (translation) {
            // https://cloud.google.com/translate/v2/using_rest#language-params
            // http://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kanji=大した&kana=たいした
            return '<span class="wanikanified" title="' + str + '" data-en="' + str + '" data-jp="' + translation +
                '" onClick="var audio = new Audio(\'http://translate.google.com/translate_tts?ie=UTF-8&q=' + translation + '&tl=ja\'); audio.play(); var t = this.getAttribute(\'title\'); this.setAttribute(\'title\', this.innerHTML); this.innerHTML = t;">' + translation + '<\/span>';
        }
        return str;
    }
}

// kick off the program
chrome.storage.local.get([VOCAB_KEY, API_KEY, SRS_KEY, CUST_VOCAB_KEY, GOOG_VOCAB_KEY, GOOG_VOCAB_META_KEY], main);
