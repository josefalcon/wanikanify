// An object that contains a dictionary of sheet collections.
// Each sheet collection contains a dictionary of sheets.
// Each sheet is an array 
var allImportedVocabDictionaries = {};

// ------------------------------------------------------------------------------------------------
function add_black_list_item(value) {
    var $blackListTable = $('#blackListTable > tbody:last');
    $blackListTable.append('<tr><td><input type="text" class="input-xlarge"><button class="btn btn-danger pull-right removeBlackListItem" type="button">Remove Item</button></td></tr>');

    if (typeof value === 'string') {
        $('#blackListTable input:last').val(value);
    }

    $('.removeBlackListItem:last').click(function() {
            $(this).closest('tr').unbind().remove();
            return false;
    });
}

// ------------------------------------------------------------------------------------------------
function add_empty_google_spread_sheet_list_item(value) {
    // HACK: This is just to auto populate for dev's convenience for now.
    add_google_spread_sheet_list_item(
    "1lIo2calXb_GtaQCMLr989_Ma_hxXlxFsHE0egko-D9k", "English", ";", "Kanji", "6k Pt 1");
}

// ------------------------------------------------------------------------------------------------
// Handler for when data has been grabbed from the Google Spreadsheet API.
function on_google_import(data, tabletop) {
   
    var spreadsheet_collection_key = data[Object.keys(data)[0]].tabletop.key;
    // Only one sheet at a time.
    var sheet_name = data[Object.keys(data)[0]].name;
    var delim = {};
    var from_column = {};
    var to_column = {};

    // Perform a lookup into the metadata to see what the columns and delimiters are.
    // When they clicked "import", the metadata was saved for that entry,
    // so we just grab it from the cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        // If the main metadata object doesn't exist yet, create one.
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("No main Google Vocab Metadata object called: " + spreadsheet_collection_key);
            return;
        }
        
        var meta_data_collection = [];
        meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            console.log("No main array found inside of main Google Vocab Metadata object.");
            return;
        }

        var mdc = meta_data_collection;
        for (var i = 0; i < mdc.length; ++i) {
            if (mdc[i].spreadsheet_collection_key == spreadsheet_collection_key &&
                mdc[i].sheet_name == sheet_name) {
                delim = mdc[i].delim;
                from_column = mdc[i].from_column;
                to_column = mdc[i].to_column;
                return;
            }
        }
    });

    // Parse table data and dump into an array.
    // For each spreadsheet. (Just one, since we only do one at a time.)
    var importedVocabArray = [];
    var sheets = tabletop.sheets(sheet_name).all();
    $.each(sheets, function(key, entry) {
        // Split up the english words by the delimiter (comma?).
        var splitEnglishWords = entry[from_column].split(delim);
        for (k = 0; k < splitEnglishWords.length; k++) {
            var eng_words = splitEnglishWords[k].trim();
            var jap_word = entry[to_column].trim();
            if (eng_words.length == 0 || jap_word.length == 0)
                continue;
            var o = {eng: eng_words, jap: jap_word};
            importedVocabArray.push(o);
        }
    })

    // Dump array of data into the master dictionary.
    // Grab the spreadsheet object.
    var all_sheets = allImportedVocabDictionaries[spreadsheet_collection_key];
    if (!all_sheets) {
        // No entry for this spreadsheet.
        // Create an empty spreadsheet object.
        var sheets = {};
        allImportedVocabDictionaries[spreadsheet_collection_key] = sheets;
        all_sheets = allImportedVocabDictionaries[spreadsheet_collection_key];
    }
    // Add or replace vocab to this particular sheet.
    all_sheets[sheet_name] = importedVocabArray;

    console.log("Imported " + importedVocabArray.length + " from " + sheet_name +
                " in collection " + spreadsheet_collection_key);
}

// ------------------------------------------------------------------------------------------------
function on_click_import_button()
{
    // Retrieve metadata from gui elements.
    var row = $(this).closest('tr');
    var spreadsheet_collection_key = row.find('input[name=spreadsheet_collection_key]').val();
    var from_column = row.find('input[name=from_col]').val();
    var delim       = row.find("input[name='delim']").val();
    var to_column   = row.find('input[name=to_col]').val();
    var sheet_name  = row.find("input[name='sheet_name']").val();

    // Tabletop needs this data, so we save it so it can access it.
    var meta_data = {
        "spreadsheet_collection_key": spreadsheet_collection_key,
        "from_column": from_column,
        "delim": delim,
        "to_column": to_column,
        "sheet_name": sheet_name
    };
    saveGoogleMetadataEntry(meta_data);

    // Import the data.
    Tabletop.init( { key: spreadsheet_collection_key,
                     callback: on_google_import,
                     wanted: [sheet_name],
                     debug: true } );

    saveAllGoogleImported();

    return true;
}

// ------------------------------------------------------------------------------------------------
function on_click_remove_item_button() {
    var row = $(this).closest('tr');
    var spreadsheet_collection_key = row.find('input[name=spreadsheet_collection_key]').val();
    var sheet_name = row.find('input[name=sheet_name]').val();

    var spread_sheet = allImportedVocabDictionaries[spreadsheet_collection_key];
    // Delete the imported data, if it was imported.
    if (spread_sheet) {
        delete spread_sheet[sheet_name];
        saveAllImported();
    }

    // Delete the saved metadata.
    deleteGoogleMetadataEntry(spreadsheet_collection_key, sheet_name);
    
    // Delete the gui elements.
    $(this).closest('tr').unbind().remove();
    return true;
}

// ------------------------------------------------------------------------------------------------
// spreadsheet_collection_key: The unique id for the spreadsheet collection (found in the url).
// sheet_name: A single spreadsheet name. A spreadsheet collection can have multiple sheets.
function add_google_spread_sheet_list_item(spreadsheet_collection_key,
                                           from_column,
                                           delim,
                                           to_column,
                                           sheet_name) {
    var $googleSpreadSheetListTable = $('#googleSpreadSheetListTable > tbody:last');
    $googleSpreadSheetListTable.append('<tr></tr>');
    // Grab the last row element.
    $row = $('#googleSpreadSheetListTable > tbody:last > tr:last');
    $row.append('<td><input type="text" class="input-medium" name="spreadsheet_collection_key" placeholder="Spreadsheet key" value="' + spreadsheet_collection_key + '"></td>');
    $row.append('<td><input type="text" class="input-medium" name="from_col" placeholder="From column header" value="' + from_column + '"></td>');
    $row.append('<td><input type="text" class="input-mini" name="delim" placeholder="Delimiter" value="' + delim + '"></td>');
    $row.append('<td><input type="text" class="input-medium" name="to_col" placeholder="To column header" value="' + to_column + '"></td>');
    $row.append('<td><input type="text" class="input-medium" name="sheet_name" placeholder="Sheet Name" value="' + sheet_name + '"></td>');
    $row.append('<td><button class="btn btn-success pull-right importGoogleSpreadSheetData" type="button">Import Data</button></td>');
    $row.append('<td><button class="btn btn-danger pull-right removeGoogleSpreadSheetListItem" type="button">Remove Item</button></td>');

    $('.removeGoogleSpreadSheetListItem:last').click(on_click_remove_item_button);    
    $('.importGoogleSpreadSheetData:last').click(on_click_import_button);
}

// ------------------------------------------------------------------------------------------------
// TODO: This probably should be changed to not save everything, but just a single sheet.
// It only saves when the user clicks import.?
function saveAllGoogleImported() {
    // Saves the imported vocab data.
    var obj = {};
    obj["wanikanify_googleVocabKey"] = {collections: allImportedVocabDictionaries};
    chrome.storage.local.set(obj, function(data) {
        console.log("Saved google data.");
        if(chrome.runtime.lastError)
        {
            console.log("Could not save google data.");
            return;
        }
    });
}

// ------------------------------------------------------------------------------------------------
function restoreAllGoogleImported(items) {
    var data = items.wanikanify_googleVocabKey;
    if (!data) {
        console.log("No Google data to load.");
        return;
    }
    allImportedVocabDictionaries = data;
    console.log("Loaded Google data.");
}

// ------------------------------------------------------------------------------------------------
function restoreAllGoogleMetadata(items) {
    var meta_data = items.wanikanify_googleVocab_meta;
    if (!meta_data) {
        return;
    }

    var d = meta_data.data;
    for (var i = 0; i < meta_data.length; ++i) {
        // TODO: Compute number of items.
        var item_count = 5000;
        add_google_spread_sheet_list_item(meta_data[i].spreadsheet_collection_key,
                                          meta_data[i].from_column,
                                          meta_data[i].delim,
                                          meta_data[i].to_column,
                                          meta_data[i].sheet_name);
                                          // TODO: Item count.
    }
}

// ------------------------------------------------------------------------------------------------
function deleteGoogleMetadataEntry(spreadsheet_collection_key, sheet_name) {
    // Retrieve the main metadata object from cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        // If the main metadata object doesn't exist yet, bail.
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("No main Google Vocab Metadata object found in cache.");
            return;
        }

        // If the array inside the main metadata object doesn't exist, bail.
        // The array is an array of objects where each object is a row in the google gui list (a list item).
        var meta_data_collection = [];
        meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            console.log("No main array found inside of main Google Vocab Metadata object.");
            return;
        }

        // See if we already have this key/sheet name combo in the list.
        for (md in meta_data_collection) {
            if (meta_data_collection[md].spreadsheet_collection_key == spreadsheet_collection_key &&
                meta_data_collection[md].sheet_name == sheet_name) {
                    delete meta_data_collection[md];
                    break;
            }
        }

        // Save the main meta data object out to chrome storage with the deleted metadata entry.
        chrome.storage.local.set(meta_data_container, function(data) {
            if(chrome.runtime.lastError)
            {
                console.log("Could not save Google metadata.");
                return;
            }
        });
    });
}

// ------------------------------------------------------------------------------------------------
function saveGoogleMetadataEntry(meta_data) {
    // Retrieve the main metadata object from cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        // If the main metadata object doesn't exist yet, create one.
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("No main Google Vocab Metadata object found in cache.");
            meta_data_container = {};
        }

        // If the array inside the main metadata object doesn't exist, create one.
        // The array is an array of objects where each object is a row in the google gui list (a list item).
        var meta_data_collection = [];
        meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            console.log("No main array found inside of main Google Vocab Metadata object.");
            meta_data_container["meta_data_collection"] = meta_data_collection;
        }

        // See if we already have this key/sheet name combo in the list.
        var found = false;
        var found_data = {};
        for (md in meta_data_collection) {
            if (meta_data_collection[md].spreadsheet_collection_key ==
                meta_data.spreadsheet_collection_key &&
                meta_data_collection[md].sheet_name == meta_data.sheet_name) {
                    found = true;
                    found_data = meta_data_collection[md];
                    break;
            }
        }

        // If it's already in the list, just update the data,
        // otherwise add a new metadata entry.
        if (!found) {
            console.log("No metadata entry found for: ");
            meta_data_collection.push(meta_data);
        } else {
            console.log("Updating metadata entry: ");
            found_data = meta_data;
        }
        console.log(meta_data.spreadsheet_collection_key);
        console.log(meta_data.sheet_name);

        // Save the main meta data object out to chrome storage with the newly updated metadata entry.
        chrome.storage.local.set(meta_data_container, function(data) {
            console.log("Saved Google metadata named: ");
            console.log("Spreadsheet Collection Key: " + found_data.spreadsheet_collection_key);
            console.log("Spreadsheet Name: " + found_data.sheet_name)
            if(chrome.runtime.lastError)
            {
                console.log("Could not save Google metadata.");
                return;
            }
        });
    });
}
// ------------------------------------------------------------------------------------------------
// Saves the metadata.
// This data is the same data that's in the GUI elements.
function saveAllGoogleMetadata() {
    
    // TODO: Save spreadsheet key and stuff.
    // Save the google spreadsheet import settings.
    //$row.append('<td><input type="text" class="input-medium" name="spreadsheet_key" placeholder="Spreadsheet key" value="' + public_spreadsheet_key + '"></td>');
    //$row.append('<td><input type="text" class="input-medium" name="from_col_header" placeholder="From column header" value="' + from_column + '"></td>');
    //$row.append('<td><input type="text" class="input-mini" name="delim" placeholder="Delimiter" value="' + delim + '"></td>');
    //$row.append('<td><input type="text" class="input-medium" name="to_col_header" placeholder="To column header" value="' + to_column + '"></td>');
    //$row.append('<td><input type="text" class="input-medium" name="sheet_name" placeholder="Sheet Name" value="' + sheet_name + '"></td>');

    // Retrieve the entire list.
    var googleSpreadSheetList = $('#googleSpreadSheetListTable input:text');
    var stuff2 = googleSpreadSheetList.map(function() {
        return $(this).val();
    });
    var stuff3 = stuff2.filter(function(index, value) {
        return value;
    });
    var stuff4 = stuff3.get();
    
    var meta_data = {
        "spreadsheet_collection_key": spreadsheet_collection_key,
        "from_column": from_column,
        "delim": delim,
        "to_column": to_column,
        "sheet_name": sheet_name,
    };
    saveGoogleMetadataEntry(meta_data);
}

// ------------------------------------------------------------------------------------------------
function save_options() {
    var apiKey = $("#apiKey").val();
    if (!apiKey) {
        $("#apiKeyControl").addClass("error");
        $(".alert-success").hide();
        $(".alert-error").show();
        return;
    }

    $("#apiKeyControl").removeClass("error");
    $(".alert-error").hide();

    chrome.storage.local.set({"wanikanify_apiKey":apiKey});

    var runOn = $('input:radio[name=runOn]:checked').val();
    chrome.storage.local.set({"wanikanify_runOn":runOn});

    var srs = $('input:checkbox[name=srs]:checked').map(function() {
        return this.value
    }).get();
    chrome.storage.local.set({"wanikanify_srs":srs});

    var blackList = $('#blackListTable input').map(function() {
        return $(this).val();
    }).filter(function(index, value) {
        return value;
    }).get();

    chrome.storage.local.set({"wanikanify_blackList":blackList});

    saveAllGoogleMetadata();
    saveAllGoogleImported();
    
    // Save the custom vocab data.
    var customVocab = $("#customVocab").val();
    chrome.storage.local.set({"wanikanify_customvocab":customVocab});
}

// ------------------------------------------------------------------------------------------------
function restore_options() {
    chrome.storage.local.get([
        "wanikanify_apiKey",
        "wanikanify_runOn",
        "wanikanify_srs",
        "wanikanify_blackList",
        "wanikanify_customvocab",
        "wanikanify_googleVocabKey",
        "wanikanify_googleVocab_meta"],
        function(items) {
            var apiKey = items.wanikanify_apiKey;
            if (apiKey) {
                $("#apiKey").val(apiKey);
            }

            var runOn = items.wanikanify_runOn;
            if (runOn == "onUpdated") {
                $('#runOnUpdated').click();
            } else {
                $('#runOnClick').click();
            }
            var srs = items.wanikanify_srs;
            if (srs) {
                // clear everything
                $('input:checkbox[name=srs]:checked').each(function(index, item) {
                    $(item).prop("checked", false);
                });

                // set what needs to be set.
                $.each(srs, function(index, value) {
                    $("#"+value).prop("checked", true);
                });
            }
            var blackList = items.wanikanify_blackList;
            $.each(blackList, function(i, value) {
                add_black_list_item(value);
            });

            var customVocab = items.wanikanify_customvocab;
            if (customVocab) {
                $("#customVocab").val(customVocab);
            }
            
            restoreAllGoogleImported(items);
            restoreAllGoogleMetadata(items);
        }
    );
}

// ------------------------------------------------------------------------------------------------
function clear_cache() {
    chrome.storage.local.remove("wanikanify_vocab");
    chrome.storage.local.remove("wanikanify_customvocab");
    // TODO: Clear the text box? Or maybe don't clear custom vocab?
  
    // Do not clear the Google spreadsheet metadata entries. They can delete those manually.
    // But they'll know if stuff is imported based on the "imported" label that they can see.
    // Clearing the cache will remove all the imported data though.
    chrome.storage.local.remove("wanikanify_googleVocabKey");
    // TODO: Update the "imported" labels.

    allImportedVocabDictionaries = {};
    
    console.log("Cache cleared.");
    $(".alert-success").show();
}

// ------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', restore_options);
document.addEventListener('DOMContentLoaded', function() {
    $('#save').click(save_options);
    $('#clearCache').click(clear_cache);
    $('#addBlackListItem').click(add_black_list_item);
    $('#addGoogleSpreadSheetListItem').click(add_empty_google_spread_sheet_list_item);
});