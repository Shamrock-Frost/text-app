/**
 * @constructor
 */
function Background() {
  this.entriesToOpen_ = [];
  this.windows_ = [];
}

/**
 * @return {boolean}
 * True if the system window frame should be shown. It is on the systems where
 * borderless window can't be dragged or resized.
 */
Background.prototype.ifShowFrame_ = function() {//get os/chrome version to show frame or not --- unimportant, will be in browser
  var version = parseInt(navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10);
  var os = 'other';
  if (navigator.appVersion.indexOf('Linux') != -1) {
    os = 'linux';
  } else if (navigator.appVersion.indexOf('CrOS') != -1) {
    os = 'cros';
  } else if (navigator.appVersion.indexOf('Mac OS X') != -1) {
    os = 'mac';
  }

  return os === 'linux' && version < 27 ||
         os === 'mac' && version < 25;
};

Background.prototype.newWindow = function() {
  var appWindowId = 'appWindow' + this.windows_.length;
  var options = {
    id: appWindowId,
    frame: (this.ifShowFrame_() ? 'chrome' : 'none'),
    minWidth: 400,
    minHeight: 400,
    width: 700,
    height: 700
  };


  chrome.app.window.create('index.html', options, function(win) {
    console.log('Window opened:', win);
    win.onClosed.addListener(this.onWindowClosed.bind(this, win));//on clsoe  run {BG}.onWindowClosed(win);
  }.bind(this));
};

/**
 * @param {Object.<string, Object>} launchData
 * Handle onLaunch event.
 */
Background.prototype.launch = function(launchData) {
  var entries = [];
  //push list of files to open to this.entriesToOpen_
  chrome.storage.local.get('retainedEntryIds', function(data) {
    var retainedEntryIds = data['retainedEntryIds'] || [];
    for (var i = 0; i < retainedEntryIds.length; i++) {
      chrome.fileSystem.restoreEntry(retainedEntryIds[i], function(entry) {
        this.entriesToOpen_.push(entry);
      }.bind(this));
    }
  }.bind(this));

  //if launched with file args to open
  if (launchData && launchData['items']) {
    for (var i = 0; i < launchData['items'].length; i++) {
      entries.push(launchData['items'][i]['entry']);
    }
  }

  if (this.windows_.length == 0)
    this.newWindow(); // open index.html
//push writable entries to ..toOpen array from arg list parameters
  for (var i = 0; i < entries.length; i++) {
    chrome.fileSystem.getWritableEntry(
        entries[i],
        function(entry) {
          if (this.windows_.length > 0) {
            this.windows_[0].openEntries([entry]);
          } else {
            this.entriesToOpen_.push(entry);
          }
        }.bind(this));
  }
};

/**
 * @param {Window} win
 * Handle onClosed.
 */
Background.prototype.onWindowClosed = function(win) {
  console.log('Window closed:', win);
  if (!win.contentWindow || !win.contentWindow.textApp) {//check textApp in scope of app 
    console.warn('No TextApp object in the window being closed:',
                 win.contentWindow, win.contentWindow.textApp);
    return;
  }
  var textApp = win.contentWindow.textApp;
  for (var i = 0; i < this.windows_.length; i++) {
    if (textApp === this.windows_[i]) {
      this.windows_.splice(i, 1);//windows_ == array of textApp objects, remove the closed obj
    }
  }

  var toRetain = textApp.getFilesToRetain();
  this.retainFiles_(toRetain);//save files i guess
};

/**
 * @param {Array.<FileEntry>} toRetain
 */
Background.prototype.retainFiles_ = function(toRetain) {//save files for later
  console.log('Got ' + toRetain.length + ' files to retain:', toRetain);
  var toRetainEntryIds = [];
  for (var i = 0; i < toRetain.length; i++) {
    var entryId = chrome.fileSystem.retainEntry(toRetain[i]);
    toRetainEntryIds.push(entryId);
  }
  chrome.storage.local.set({'retainedEntryIds': toRetainEntryIds});
};

/**
 * @param {TextApp} textApp
 * Called by the TextApp object in the window when the window is ready.
 */
Background.prototype.onWindowReady = function(textApp) {
  this.windows_.push(textApp);
  textApp.setHasChromeFrame(this.ifShowFrame_());

  if (this.entriesToOpen_.length > 0) {
    textApp.openEntries(this.entriesToOpen_);
    this.entriesToOpen_ = [];
  } else {
    textApp.openNew();
  }
};

/**
 * @param {FileEntry} entry
 * @param {function(FileEntry)} callback
 * Make a copy of a file entry.
 */
Background.prototype.copyFileEntry = function(entry, callback) {
  chrome.fileSystem.getWritableEntry(entry, callback);
};

//launch listener is new Background()'s .launch property, bound to its object
var background = new Background();
chrome.app.runtime.onLaunched.addListener(background.launch.bind(background));


/* Exports */
window['background'] = background;
Background.prototype['copyFileEntry'] = Background.prototype.copyFileEntry;
Background.prototype['onWindowReady'] = Background.prototype.onWindowReady;
Background.prototype['newWindow'] = Background.prototype.newWindow;
