const remote = require('electron').remote;
const app = remote.app;
const settings = require('electron-settings');
const $ = require('jquery')
const dialog = remote.dialog;
const { ipcRenderer } = require('electron')

var settingsValues = app.ep.settings.getAll();
var shell = require('electron').shell;

$('#doKey').val(settingsValues.do_api_key);
$('#filename').val(settingsValues.filename);
$('#port').val(settingsValues.port);
$('#userAuth').val(settingsValues.userAuth);

$('#doKey').on('change', function() {
    settingsValues.do_api_key = $(this).val()
    app.ep.settings.set('do_api_key', $(this).val());
});

$('#filename').on('change', function() {
  settingsValues.filename = $(this).val()
  app.ep.settings.set('filename', $(this).val());
});
$('#port').on('change', function() {
  settingsValues.port = $(this).val()
  app.ep.settings.set('port', $(this).val());
});
$('#userAuth').on('change', function() {
  settingsValues.userAuth = $(this).val()
  app.ep.settings.set('userAuth', $(this).val());
});

$('#saveSettings').on('click', function() {
    ipcRenderer.send('refreshMainWindow');
    console.log(app.ep.settings.get('port'))
});

$('#destroy').on('click', function() {
  $("#destroy").prop("disabled", true);
  if (settingsValues.do_api_key == null || settingsValues.do_api_key == "") {
    $('#destroy').text('No API Key was found');
    setTimeout(function(){
      $('#destroy').text('Destroy');
      $("#destroy").prop("disabled", false);
    }, 5000);
  } else {
    $('#destroy').text('Destroying...');
    ipcRenderer.send('wipeDroplets');
  }
});

$('#reset').on('click', function() {
  dialog.showMessageBox({
      "message": `Are you sure you want to reset?`,
      "detail": "You will not be able to recover any task data after you perform this action.",
      "buttons": ["Ok", "Cancel"],
  }, function(response) {
      switch (response) {
          case 0:
              ok();
          case 1:
              break;
      }
  });
  function ok() {
    settings.resetToDefaults()
    ipcRenderer.send('resetApp');
  }
});

ipcRenderer.on('errDestroy', function(event, data) {

  $('#destroy').text('Error Occured while destroying');

  setTimeout(function(){
    $('#destroy').text('Destroy');
    $("#destroy").prop("disabled", false);
  }, 5000);

});

ipcRenderer.on('wipe-complete', function(event, data) {
  $('#destroy').text('All Droplets have been destroyed');

  setTimeout(function(){
    $('#destroy').text('Destroy');
    $("#destroy").prop("disabled", false);
  }, 5000);
});