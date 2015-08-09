// An object that contains a dictionary of sheet collections.
// Each sheet collection contains a dictionary of sheets.
// Each sheet is an array 
var allImportedVocabDictionaries = {};

// ------------------------------------------------------------------------------------------------
function add_black_list_item(value) {
    var $blackListTable = $('#blackListTable > tbody:last');
    $blackListTable.append('<tr><td><input type="text" class="input-xlarge"><button class="btn btn-danger pull-right removeBlackListItem" type="button">Remove Data</button></td></tr>');

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
    console.log("add_empty_google_spread_sheet_list_item()");
    // HACK: This is just to auto populate for dev's convenience for now.
    //$( "#google_failed_import" ).dialog();
    add_google_spread_sheet_list_item(
    "1lIo2calXb_GtaQCMLr989_Ma_hxXlxFsHE0egko-D9k", "English", ",", "Kanji", "Hiragana", "6k Pt 1", 0);
}

// ------------------------------------------------------------------------------------------------
// DONE
// This updates the "import count" label. This is totally an insane way of doing it,
// but I couldn't figure out how to use JQuery to do it properly.
function update_import_count(spreadsheet_collection_key, sheet_name, count) {
    // FIX: I think I can just use this, but I'm not sure.
    //var data = $('#googleSpreadSheetListTable input:text').map(function() {
    //    return $(this).val();
    //}).filter(function(index, value) {
    //    return value;
    //}).get();
    
    var elements = $('#googleSpreadSheetListTable > tbody > tr');
    for (var i = 0; i < elements.length; ++i) {
        var children = elements[i].children;
        var key = {};
        var sn = {};
        var import_count = {};
        for (var j = 0; j < children.length; ++j) {
            var input_field = children[j].children.spreadsheet_collection_key;
            if (input_field) {
                key = input_field.value;
            }
            input_field = children[j].children.sheet_name;
            if (input_field) {
                sn = input_field.value;
            }
            input_field = children[j].children.import_count;
            if (input_field) {
                import_count = input_field;
            }
        }
        if (key == spreadsheet_collection_key && sn == sheet_name) {
            import_count.outerText = count.toString();
        }
    }
}

// ------------------------------------------------------------------------------------------------
// DONE
// Handler for when data has been grabbed from the Google Spreadsheet API. Called from tabletop.
function on_google_import(data, tabletop) {
    console.log("on_google_import()");
    
    // The data failed to import properly.
    if (!data) {
        $( "#google_failed_import" ).dialog();
        return;
    }

    var spreadsheet_collection_key = tabletop.key;
    // We only support one sheet at a time.
    var sheet_name = data[Object.keys(data)[0]].name;

    // Perform a lookup into the metadata to see what the columns and delimiters are.
    // When they clicked "import", the metadata was saved for that entry,
    // so we just grab it from the cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        var delim = {};
        var from_column = {};
        var to_column = {};

        // If the main metadata object doesn't exist yet, create one.
        console.log("on_google_import() - Grabbing metadata container from cache.");
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("on_google_import() - No main Google Vocab Metadata object called: " + spreadsheet_collection_key);
            return;
        }
        
        console.log("on_google_import() - Grabbing metadata collection from container.");
        var meta_data_collection = [];
        meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            console.log("on_google_import() - No main array found inside of main Google Vocab Metadata object.");
            return;
        }

        console.log("on_google_import() - Grabbing specific metadata from collection.");
        var mdc = meta_data_collection;
        var found = false;
        for (var i = 0; i < mdc.length; ++i) {
            if (mdc[i].spreadsheet_collection_key == spreadsheet_collection_key &&
                mdc[i].sheet_name == sheet_name) {
                delim = mdc[i].delim;
                from_column = mdc[i].from_column;
                to_column = mdc[i].to_column;
                reading_column = mdc[i].reading_column;
                console.log("on_google_import() - Found metadata: ");
                console.log("on_google_import() - to_column: " + to_column);
                console.log("on_google_import() - delim: " + delim);
                console.log("on_google_import() - from_column: " + from_column);
                console.log("on_google_import() - reading_column: " + reading_column);
                found = true;
                break;
            }
        }
        
        // The data was supposed to be saved out to the metadata cache, but we couldn't
        // find it for some reason. Can't continue.
        if (found == false) {
            deleteGoogleMetadataEntry(spreadsheet_collection_key, sheet_name);
            $( "#google_failed_import" ).dialog();
            return;
        }

        // Parse table data and dump into an array.
        // For each spreadsheet. (Just one, since we only do one at a time.)
        console.log("on_google_import() - Parsing data...");
        var importedVocabArray = [];
        var sheets = tabletop.sheets(sheet_name).all();
        $.each(sheets, function(key, entry) {
            // Split up the english words by the delimiter (comma?).
            var splitEnglishWords = entry[from_column].split(delim);
            for (k = 0; k < splitEnglishWords.length; k++) {
                var eng_words = splitEnglishWords[k].trim();
                var jap_word = entry[to_column].trim();
                var reading = entry[reading_column];
                if (reading)
                    reading = reading.trim();
                if (eng_words.length == 0 || jap_word.length == 0)
                    continue;
                var o = {eng: eng_words, jap: jap_word, jap_reading:reading};
                importedVocabArray.push(o);
            }
        })

        // Dump array of data into the master dictionary.
        console.log("on_google_import() - Dumping parsed data into master dictionary...");
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

        saveAllGoogleImported();
        console.log("on_click_import_button() - Saved google data.");

        update_import_count(spreadsheet_collection_key, sheet_name, importedVocabArray.length);
    });
}

// ------------------------------------------------------------------------------------------------
// DONE
function input_is_valid(text) {
    var t = text.trim();
    if (t === "") {
        console.log("validate_input() - Failed to validate input: " + text);
        return false;
    }
    return true;
}

// ------------------------------------------------------------------------------------------------
// DONE
// Handler for when the user clicks the "import" button for a particular row.
// 1) Retrieves the google spreadsheet data for a particular sheet/key combo.
// 2) Saves the metadata (the data from the gui controls).
// 3) Saves the imported google spreadsheet data to local cache.
function on_click_import_button() {
    console.log("on_click_import_button()");

    // Retrieve metadata from gui elements.
    var row = $(this).closest('tr');
    var spreadsheet_collection_key = row.find('input[name=spreadsheet_collection_key]').val().trim();
    var from_column    = row.find("input[name='from_column']").val().trim();
    var delim          = row.find("input[name='delim']").val().trim();
    var to_column      = row.find("input[name='to_column']").val().trim();
    var reading_column = row.find("input[name='reading_column']").val().trim();
    var sheet_name     = row.find("input[name='sheet_name']").val().trim();
    console.log("on_click_import_button() - Grabbed data from gui elements.");
    
    // Basic input validation here.
    if (!input_is_valid(spreadsheet_collection_key) ||
        !input_is_valid(from_column) ||
        !input_is_valid(delim) ||
        !input_is_valid(to_column) ||
        !input_is_valid(sheet_name)) {
        $( "#google_bad_spreadsheet_data" ).dialog();
        return;
    }

    var meta_data = {
        "spreadsheet_collection_key": spreadsheet_collection_key,
        "from_column": from_column,
        "delim": delim,
        "to_column": to_column,
        "reading_column": reading_column,
        "sheet_name": sheet_name
    };
    
    // Tabletop needs the metadata, so we save it so it can access it in the "on_google_import" handler.
    // Save the metadata.
    saveGoogleMetadataEntry(meta_data);
    console.log("on_click_import_button() - Saved metadata.");

    // Import the data and save it.
    console.log("on_click_import_button() - Importing google data.");
    Tabletop.init( { key: spreadsheet_collection_key,
                     callback: on_google_import,
                     wanted: [sheet_name],
                     debug: false } );

    return true;
}

// ------------------------------------------------------------------------------------------------
// DONE
// 1) This should delete the row (gui elements)
// 2) This should delete the saved data in that row (the metadata).
// 3) This should delete the imported vocab words from this sheet/key combo.
function on_click_remove_item_button() {
    console.log("on_click_remove_item_button()");

    console.log("on_click_remove_item_button() - Finding row...");
    var row = $(this).closest('tr');
    var spreadsheet_collection_key = row.find('input[name=spreadsheet_collection_key]').val();
    var sheet_name = row.find('input[name=sheet_name]').val();

    console.log("on_click_remove_item_button() - Deleting vocab data.");
    var spread_sheets = allImportedVocabDictionaries[spreadsheet_collection_key];
    // 3) Delete the imported data, if it was imported.
    if (spread_sheets) {
        delete spread_sheets[sheet_name];
        if (Object.keys(spread_sheets).length == 0) {
            delete allImportedVocabDictionaries[spreadsheet_collection_key];
        }
        console.log("on_click_remove_item_button() - Deleted vocab data.");
        saveAllGoogleImported();
    }

    console.log("on_click_remove_item_button() - Deleting metadata for this entry.");
    // 2) Delete the saved metadata.
    deleteGoogleMetadataEntry(spreadsheet_collection_key, sheet_name);
    
    // 1) Delete the gui elements.
    $(this).closest('tr').unbind().remove();
    console.log("on_click_remove_item_button() - Deleted gui elements.");
    return true;
}

// ------------------------------------------------------------------------------------------------
// DONE
// Creates a row in the gui so the user can fill it in. Also hooks up the handlers for the buttons.
// spreadsheet_collection_key: The unique id for the spreadsheet collection (found in the url).
// sheet_name: A single spreadsheet name. A spreadsheet collection can have multiple sheets.
function add_google_spread_sheet_list_item(spreadsheet_collection_key,
                                           from_column,
                                           delim,
                                           to_column,
                                           reading_column,
                                           sheet_name,
                                           count) {
    console.log("add_google_spread_sheet_list_item()");
    console.log("add_google_spread_sheet_list_item() - " + spreadsheet_collection_key);
    console.log("add_google_spread_sheet_list_item() - " + from_column);
    console.log("add_google_spread_sheet_list_item() - " + delim);
    console.log("add_google_spread_sheet_list_item() - " + to_column);
    console.log("add_google_spread_sheet_list_item() - " + reading_column);
    console.log("add_google_spread_sheet_list_item() - " + sheet_name);
    
    var $googleSpreadSheetListTable = $('#googleSpreadSheetListTable > tbody:last');
    $googleSpreadSheetListTable.append('<tr></tr>');
    // Grab the last row element.
    $row = $('#googleSpreadSheetListTable > tbody:last > tr:last');
    $row.append('<td><input type="text" class="input-medium" name="spreadsheet_collection_key" placeholder="Spreadsheet key" value="' + spreadsheet_collection_key + '"></td>');
    $row.append('<td><input type="text" class="input-mini" name="from_column" placeholder="From column header" value="' + from_column + '"></td>');
    $row.append('<td><input type="text" class="input-mini" name="delim" placeholder="Delimiter" value="' + delim + '"></td>');
    $row.append('<td><input type="text" class="input-mini" name="to_column" placeholder="To column header" value="' + to_column + '"></td>');
    $row.append('<td><input type="text" class="input-mini" name="reading_column" placeholder="Reading column header" value="' + reading_column + '"></td>');
    $row.append('<td><input type="text" class="input-small" name="sheet_name" placeholder="Sheet Name" value="' + sheet_name + '"></td>');
    $row.append('<td style="text-align:center">Entries Added <div id="import_count">' + count.toString() + '</div></td>');
    $row.append('<td><button class="btn btn-success pull-right importGoogleSpreadSheetData" type="button">Import Data</button></td>');
    $row.append('<td><button class="btn btn-danger pull-right removeGoogleSpreadSheetListItem" type="button">Remove Item</button></td>');

    $('.removeGoogleSpreadSheetListItem:last').click(on_click_remove_item_button);
    $('.importGoogleSpreadSheetData:last').click(on_click_import_button);
    
    // Note: If they click the import, remove, or save, the metadata gets saved.
}

// ------------------------------------------------------------------------------------------------
// DONE
// TODO: This probably should be changed to not save everything, but just a single sheet.
// It only saves when the user clicks import or deletes a row.
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
// DONE
function restoreAllGoogleImported(items) {
    console.log("restoreAllGoogleImported()");
    var data = items.wanikanify_googleVocabKey;
    if (!data) {
        console.log("restoreAllGoogleImported() - No Google data to load.");
        return;
    }
    allImportedVocabDictionaries = data.collections;
    console.log("restoreAllGoogleImported() - Loaded Google data.");
}

// ------------------------------------------------------------------------------------------------
// DONE
// This rebuilds the google import rows based on what's in storage.
function restoreAllGoogleMetadata(items) {
    console.log("restoreAllGoogleMetadata()");
    var meta_data = items.wanikanify_googleVocab_meta;
    if (!meta_data) {
        console.log("restoreAllGoogleMetadata() - No metadata to restore.");
        return;
    }

    var d = meta_data.meta_data_collection;
    console.log("restoreAllGoogleMetadata() - Restoring: " + d.length + " sheets.");
    for (var i = 0; i < d.length; ++i) {
        console.log("restoreAllGoogleMetadata() - Restoring: " + d[i].spreadsheet_collection_key + ", " + d[i].sheet_name);
        
        // It's possible they created the row, but never imported anything. If that's the case,
        // there wouldn't be any data saved out and this code would fail.
        var item_count = 0;
        var collection = allImportedVocabDictionaries[d[i].spreadsheet_collection_key];
        if (collection) {
            var sheet = collection[d[i].sheet_name];
            if (!sheet) {
                return;
            }
            item_count = sheet.length;
        }
        add_google_spread_sheet_list_item(d[i].spreadsheet_collection_key,
                                          d[i].from_column,
                                          d[i].delim,
                                          d[i].to_column,
                                          d[i].reading_column,
                                          d[i].sheet_name,
                                          item_count);
    }
}

// ------------------------------------------------------------------------------------------------
// DONE
function deleteGoogleMetadataEntry(spreadsheet_collection_key, sheet_name) {
    console.log("deleteGoogleMetadataEntry()");
    console.log("deleteGoogleMetadataEntry() - Spreadsheet collection key: " + spreadsheet_collection_key);
    console.log("deleteGoogleMetadataEntry() - Sheet name: " + sheet_name);
    // Retrieve the main metadata object from cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        // If the main metadata object doesn't exist yet, bail.
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("deleteGoogleMetadataEntry() - No main Google Vocab Metadata object found in cache.");
            return;
        }

        // If the array inside the main metadata object doesn't exist, bail.
        // The array is an array of objects where each object is a row in the google gui list (a list item).
        var meta_data_collection = [];
        meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            console.log("deleteGoogleMetadataEntry() - No main array found inside of main Google Vocab Metadata object.");
            return;
        }

        // See if we already have this key/sheet name combo in the list.
        for (md in meta_data_collection) {
            if (meta_data_collection[md].spreadsheet_collection_key == spreadsheet_collection_key &&
                meta_data_collection[md].sheet_name == sheet_name) {
                    meta_data_collection.splice(md, 1);
                    console.log("deleteGoogleMetadataEntry() - Deleted metata entry.");
                    break;
            }
        }

        // Save the main meta data object out to chrome storage with the deleted metadata entry.
        console.log("deleteGoogleMetadataEntry() - Resaving all metadata.");
        var obj = {"wanikanify_googleVocab_meta": meta_data_container};
        chrome.storage.local.set(obj, function(data) {
            console.log("deleteGoogleMetadataEntry() - Saved all metadata.");
            if(chrome.runtime.lastError)
            {
                console.log("deleteGoogleMetadataEntry() - Could not save Google metadata.");
                return;
            }
         });
    });
}

// ------------------------------------------------------------------------------------------------
// DONE
function saveGoogleMetadataEntry(meta_data) {
    console.log("saveGoogleMetadataEntry()");
    console.log("saveGoogleMetadataEntry() - Attempting to save: " + meta_data.spreadsheet_collection_key + ", " + meta_data.sheet_name);
    
    // Retrieve the main metadata object from cache.
    chrome.storage.local.get("wanikanify_googleVocab_meta", function(items) {
        // If the main metadata object doesn't exist yet, create one.
        var meta_data_container = items.wanikanify_googleVocab_meta;
        if (!meta_data_container) {
            console.log("saveGoogleMetadataEntry() - No main Google Vocab Metadata object found in cache.");
            meta_data_container = {};
        }

        // If the array inside the main metadata object doesn't exist, create one.
        // The array is an array of objects where each object is a row in the google gui list (a list item).
        var meta_data_collection = meta_data_container["meta_data_collection"];
        if (!meta_data_collection) {
            meta_data_collection = [];
            console.log("saveGoogleMetadataEntry() - No main array found inside of main Google Vocab Metadata object.");
            meta_data_container["meta_data_collection"] = meta_data_collection;
        }

        // See if we already have this key/sheet name combo in the list.
        console.log("saveGoogleMetadataEntry() - Searching for metadata entry.");
        var found = false;
        var found_data = {};
        for (md in meta_data_collection) {
            if (meta_data_collection[md].spreadsheet_collection_key ==
                meta_data.spreadsheet_collection_key &&
                meta_data_collection[md].sheet_name == meta_data.sheet_name) {
                    console.log("saveGoogleMetadataEntry() - Found metadata entry.");
                    found = true;
                    found_data = meta_data_collection[md];
                    break;
            }
        }

        // If it's already in the list, just update the data,
        // otherwise add a new metadata entry.
        if (!found) {
            console.log("saveGoogleMetadataEntry() - No metadata entry found for: " + meta_data.spreadsheet_collection_key + ", " + meta_data.sheet_name);
            meta_data_collection.push(meta_data);
        } else {
            console.log("saveGoogleMetadataEntry() - Updating metadata entry: " + meta_data.spreadsheet_collection_key + ", " + meta_data.sheet_name);
            found_data = meta_data;
        }

        // Save the main meta data object out to chrome storage with the newly updated metadata entry.
        var obj = {"wanikanify_googleVocab_meta": meta_data_container};
        chrome.storage.local.set(obj, function(data) {
            console.log("saveGoogleMetadataEntry() - Saved Google metadata entry.");
            if(chrome.runtime.lastError)
            {
                console.log("saveGoogleMetadataEntry() - Could not save Google metadata.");
                return;
            }
        });
    });
}

// ------------------------------------------------------------------------------------------------
// DONE
// Saves all the metadata.
// This data is the same data that's in the GUI elements.
function saveAllGoogleMetadata() {
    // Retrieves all the text field data in an array. It's also magic.
    var data = $('#googleSpreadSheetListTable input:text').map(function() {
        return $(this).val();
    }).filter(function(index, value) {
        return value;
    }).get();

    // HACK: Super silly.
    for (var i = 0; i < data.length; i += 5) {
        var meta_data = {
            "spreadsheet_collection_key": data[i],
            "from_column": data[i+1],
            "delim": data[i+2],
            "to_column": data[i+3],
            "reading_column": data[i+4],
            "sheet_name": data[i+5],
        };
        saveGoogleMetadataEntry(meta_data);        
    }
}

// ------------------------------------------------------------------------------------------------
// DONE
function save_options() {
    console.log("save_options()");
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

    console.log("save_options() - Saving google metadata.");
    // There's the possibility the user didn't import any data.
    // In this case, we want to save their settings anyways.
    saveAllGoogleMetadata();
    // No need to save the actual imported data, it's already saved if it's imported.
    
    console.log("save_options() - Saving custom vocab.");
    // Save the custom vocab data.
    var customVocab = $("#customVocab").val();
    chrome.storage.local.set({"wanikanify_customvocab":customVocab});
}

// ------------------------------------------------------------------------------------------------
// DONE
function restore_options() {
    console.log("restore_options()");
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

            console.log("restore_options() - Restoring custom vocab.");
            var customVocab = items.wanikanify_customvocab;
            if (customVocab) {
                $("#customVocab").val(customVocab);
            }

            // We restore metadata after the vocab data so we can populate
            // the "imported count" field on the gui.
            console.log("restore_options() - Restoring all imported google data.");
            restoreAllGoogleImported(items);
            console.log("restore_options() - Restoring all google metadata.");
            restoreAllGoogleMetadata(items);
            
            // TODO: Do extra verification that the imported vocab and the metadata are
            // in sync with each other.
        }
    );
}

// ------------------------------------------------------------------------------------------------
function clear_cache() {
    console.log("clear_cache()");
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