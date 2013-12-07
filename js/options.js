function save_options() {
    var apiKey = $("#apiKey")[0].value;
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

    var srs = $('input:checkbox[name=srs]:checked');
    var srsValues = $.map(srs, function(obj) { return obj.value; }); // TODO why doesn't this work in one line?

    chrome.storage.local.set({"wanikanify_srs":srsValues});

    // TODO: CLEAN. do one set!
    clear_cache();
}

function restore_options() {
    chrome.storage.local.get(["wanikanify_apiKey","wanikanify_runOn", "wanikanify_srs"], function(items) {
        var apiKey = items.wanikanify_apiKey;
        if (apiKey) {
            $("#apiKey")[0].value = apiKey;
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
    });
}

function clear_cache() {
    chrome.storage.local.remove("wanikanify_vocab");
    $(".alert-success").show();
}

document.addEventListener('DOMContentLoaded', restore_options);
document.addEventListener('DOMContentLoaded', function() {
    $('#save').click(save_options);
    $('#clearCache').click(clear_cache);
});