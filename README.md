# Wanikanify

## Download

[Chrome Web Store](https://chrome.google.com/webstore/detail/wanikanify/dbnpfdbkecfgaffopefhalliecehhkhj)

## About

Wanikanify is a Google Chrome Extension for studying Japanese.

Wanikanify takes the vocabulary you've studied on Wanikani, finds the english word on a webpage and substitues the kanji character. As you learn more kanji, your webpages begin to fill up with kanji! Wanikanify can find words anywhere on a webpage and replace it for kanji characters. It is a great utility for practicing and recalling vocabulary you may have forgotten. 

To get started, install the extension, and go to the options page. Add your public WaniKani API key, which can be found on on the WaniKani website, and hit save.

Navigate to your favorite webpages, hit the Crabigator and read as normal. As you read you'll come across kanji characters you should know. Do you remember what the mean? How to pronounce them?

##Features
### Importing Google Spreadsheet Data
- User can now import large amounts of vocab words using google spreadsheets.
- This allows users to share their vocab lists.
- Importing from Google Spreadsheets overrides the WaniKani vocab.
- Shows the total number of entries that have been imported. Which could be multiple synonyms.

###Custom Vocab Override
- User can now override WaniKani vocab entries AND "Google spreadsheets import" using the custom vocab box.
- Or if they just want to add a few extra vocab words easily, they can also use it for that too.
- This is meant as a quick and dirty way to add your own custom vocab easily without setting up a google spreadsheet.
- For example, "times" gets translated as "〜回" from WaniKani, which is silly. So you can use this to override it to just "回" if you want.
- This is not meant for large amounts of vocab since it is also synced using Google Sync.

###Google Chrome Sync
- Settings for wanikanify now are persistence across computers if user has Chrome's sync functionality enabled.
- Note the vocab data is not synced because it's too much data. But the settings are synced, so you'll just have to click the "import" buttons again for Google Spreadsheets.

###Audio
- Mousing over (or clicking) a word will play the audio for that word from HTML5's built-in speech synthesis.
- This works very well as a learning tool in combination with rikaikun.
- It's possible the audio played could not be correct if the readings are missing from the spreadsheets, but it will try to play it anyways.
- Put in option to disable the audio functionality and change whether it's on click or on hover.
- Custom vocab can also use readings for audio.

## Contributors 

* Michael Magill
* Todd Seiler
