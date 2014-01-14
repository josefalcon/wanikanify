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
}

function restore_options() {
    chrome.storage.local.get(["wanikanify_apiKey","wanikanify_runOn", "wanikanify_srs", "wanikanify_blackList"], function(items) {
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
    $('#addBlackListItem').click(add_black_list_item);
});