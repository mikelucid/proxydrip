if(require('electron-squirrel-startup')) return;
const {
    app,
    BrowserWindow,
    Menu,
    Tray,
    ipcMain
} = require('electron')
const settings = require('./settings-manager')
const eSettings = require('electron-settings')
const electronInstaller = require('electron-winstaller')
const create = require('./create')
const path = require('path')
const async = require('async')
const ChildProcess = require('child_process')
const platform = require('os').platform()
//const halfmoon = require("halfmoon")
var DigitalOcean = require('do-wrapper').default,
    api = null;

var win, settingsWin;

const debug = /--debug/.test(process.argv[2])
//auo updating
require('update-electron-app')()
var zip = require('electron-installer-zip');

var opts = {
  dir: './out/',
  out: './out/'
};
zip(opts, function(err, res) {
  if (err) {    
    process.exit(1);
  }
  console.log('Zip file written to: ', res);
});
//Auto reload
require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
  });
// Launch Menu Spawn System

var createShortcut = function(callback) {
    spawnUpdate([
        '--createShortcut',
        path.basename(process.execPath),
        '--shortcut-locations',
        'StartMenu'
    ], callback)
}

var removeShortcut = function(callback) {
    spawnUpdate([
        '--removeShortcut',
        path.basename(process.execPath)
    ], callback)
}

var spawnUpdate = function(args, callback) {
    var updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe')
    var stdout = ''
    var spawned = null

    try {
        spawned = ChildProcess.spawn(updateExe, args)
    } catch (error) {
        if (error && error.stdout == null)
            error.stdout = stdout
        process.nextTick(function() {
            callback(error)
        })
        return
    }

    var error = null

    spawned.stdout.on('data', function(data) {
        stdout += data
    })

    spawned.on('error', function(processError) {
        if (!error)
            error = processError
    })

    spawned.on('close', function(code, signal) {
        if (!error && code !== 0) {
            error = new Error('Command failed: ' + code + ' ' + signal)
        }
        if (error && error.code == null)
            error.code = code
        if (error && error.stdout == null)
            error.stdout = stdout
        callback(error)
    })
}

switch (process.argv[1]) {
    case '--squirrel-install':
        createShortcut(function() {
            app.quit()
        });
        break;
    case '--squirrel-uninstall':
        removeShortcut(function() {
            app.quit();
        });
        break;
    case '--squirrel-obsolete':
    case '--squirrel-updated':
        app.quit();
        break;
    default:
        init();
}

function init() {
    app.on('ready', () => {

        let win = null
        let loading = new BrowserWindow({show: false, frame: false})

        settings.init()
            app.ep = {
                settings
            }


        // Create RightClick context menu for tray icon
        // with two items - 'Restore app' and 'Quit app'
        const contextMenu = Menu.buildFromTemplate([
            
            {
            label: 'Restore app',
            click: () => {
                win.show()
            }
            },
            {
            label: 'Quit app',
            click: () => {
                win.close()
            }
            }
        ])

        loading.once('show', () => {

            win = new BrowserWindow({
                width: 750,
                height: 800,
                minWidth: 750,
                minHeight: 800,
                resizable: true,
                maxWidth: 750,
                maxHeight: 640,
                fullscreenable: false,
                frame: true,
                show: false,
                icon: `${__dirname}/static/assets/logo.png`,
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: true
                }
            })
            const menuTemplate = [{
                label: 'File',
                submenu:
                [
                    {
                        label: 'Settings',
                        click() {
                            initSettings()
                        },
                        accelerator: 'CmdOrCtrl+,',
                    },
                    {
                        label: 'Quit',
                        click() {
                            app.quit()
                        },
                        accelerator: 'CmdOrCtrl+Q',
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                {role: 'undo'}, // Native electron features
                {role: 'redo'}, // Native electron features
                {role: 'cut'}, // Native electron features
                {role: 'copy'}, // Native electron features
                {role: 'paste'}, // Native electron features
                {role: 'delete'} // Native electron features
                ]
            },
            {
                label: 'View',
                submenu: [
                {role: 'reload'}, // Native electron features
                {role: 'forcereload'}, // Native electron features
                {role: 'resetzoom'}, // Native electron features
                {role: 'zoomin'}, // Native electron features
                {role: 'zoomout'} // Native electron features
                ]
            },
            {
                role: 'window',
                submenu: [
                {role: 'minimize'}, // Native electron features
                {role: 'close'} // Native electron features
                ]
            },
            {
                role: 'help',
                submenu: [
                {
                    label: 'Documentation',
                    click: () => {require('electron').shell.openExternal('https://github.com/mikelucid/proxydrip')} // Opens a URL in a new window
                },
                {
                    label: 'Issues',
                    click: () => {require('electron').shell.openExternal('https://github.com/mikelucid/proxydrip/issues')} // Opens a URL in a new window
                }
                ]
            }
            ]

            // If the platform is Mac OS, make some changes to the window management portion of the menu
            if (process.platform === 'darwin') {
                menuTemplate[2].submenu = [{
                        label: 'Close',
                        accelerator: 'CmdOrCtrl+W',
                        role: 'close'
                    },
                    {
                        label: 'Minimize',
                        accelerator: 'CmdOrCtrl+M',
                        role: 'minimize'
                    },
                    {
                        label: 'Zoom',
                        role: 'zoom'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Bring All to Front',
                        role: 'front'
                    }
                ]
            }

            // Set menu template just created as the application menu
            const mainMenu = Menu.buildFromTemplate(menuTemplate)
            Menu.setApplicationMenu(mainMenu)
            //win.webContents.openDevTools()
            //  halfmoon.onDOMContentLoaded() })
            win.setMenu(null);

            win.webContents.once('dom-ready', () => {
                console.log('main loaded') 
                win.show()
                    loading.hide()
                    loading.close()
            })
            // long loading html
           setTimeout(() => win.loadURL(`file://${__dirname}/static/index.html`), 2600);
        })  
        loading.loadURL(`file://${__dirname}/static/loading.html`)
        loading.show()
        ipcMain.on('create', function(event, args) {
            var tasks = []
            args.map(function(task, i) {
                tasks.push(function(cb) { 
                    create.task(win, task, settings, i + 1, (err, response) => {
                        if (err) {
                            return (err)
                        }
                        return cb(null, response)
                    })
                })
            })
            async.parallel(tasks, function(err, res) {
                if (err) {
                    console.log('err', err)
                } else {
                    console.log(res)
                    // TODO: When Session Ends
                    win.webContents.send('tasksEnded');
                }
            });
        });

        ipcMain.on('openSettings', function(event, args) {
            initSettings();
        });

        ipcMain.on('open-file-dialog', function(event) {
            require('electron').dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{
                    name: 'All Files',
                    extensions: ['*']
                }]
            }, function(filename) {
                if (filename) {
                    console.log(filename[0]);
                    event.sender.send('selected-file', filename[0]);
                }
            })
        });

        ipcMain.on('wipeDroplets', function(event) {
            api = new DigitalOcean(eSettings.getSync('do_api_key'));
            var droplets = [];
            api.dropletsGetAll({}, function(err, resp, body) {
                if (err) {
                    console.log(err);
                    event.sender.send('errDestroy');
                }

                for (var i = 0; i < body.droplets.length; i++) {
                    var id = body.droplets[i].id;
                    var dropletName = body.droplets[i].name;
                    if (dropletName.endsWith('-pd')) {
                        api.dropletsDelete(id, function(err, resp, body) {});
                    }
                }

                event.sender.send('wipe-complete');

                //console.log(body);
            });
        });

        ipcMain.on('resetApp', (event, args) => {
            win.close()
            settingsWin.close()
            app.quit();
        })

        ipcMain.on('refreshMainWindow', (event, args) => {
            win.webContents.send('refreshMain');
        })

        ipcMain.on('fetchForImages', function(event) {

            var options = [];
            var regionDict = [];

            api = new DigitalOcean(eSettings.getSync('do_api_key'));

            function fetchFullRegionName(shortName) {
                for (var i = 0; i < regionDict.length; i++) {
                    if (regionDict[i].slug == shortName) {
                        return regionDict[i].fullName;
                    }
                }
            }

            // Fetch for Regions and Slug Names
            api.regionsGetAll({}, function(err, resp, body) {
                if (err) {
                    // Return Error to Window
                    console.log('err', err);
                    win.webContents.send('initError');
                    return
                }
                    for (var i = 0; i < body.regions.length; i++) {
                    regionDict.push({
                        fullName: body.regions[i].name,
                        slug: body.regions[i].slug
                    })
                }

                api.imagesGetAll({type: 'distribution'}, function(err, resp, body) {
                    if (err) {
                        // Return Error to Window
                        win.webContents.send('initError');
                        return
                    }

                    for (var i = 0; i < body.images.length; i++) {
                        // Look for 64bit versions of Debian 10
                        if (body.images[i].distribution.indexOf('Debian') > -1) {
                            if (body.images[i].name.split(' ')[0].startsWith('10')) {
                                for (var x = 0; x < body.images[i].regions.length; x++) {

                                    if (fetchFullRegionName(body.images[i].regions[x]) != undefined) {
                                        options.push({
                                            title: `Debian ${body.images[i].name} - ${body.images[i].id} - (${fetchFullRegionName(body.images[i].regions[x])})`,
                                            region: body.images[i].regions[x],
                                            slug: body.images[i].id
                                        })
                                    }
                                }

                            }
                        }
                    }

                    win.webContents.send('updateOptionList', options);

                });
            });

        });
    });
}
function initSettings() {
    settingsWin = new BrowserWindow({
        backgroundColor: '#ffffff',
        center: true,
        fullscreen: false,
        height: 700,
        icon: `${__dirname}/static/assets/logo.png`,
        maximizable: false,
        minimizable: false,
        resizable: false,
        show: false,
        skipTaskbar: true,
        title: 'Settings',
        useContentSize: true,
        width: 650,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    settingsWin.loadURL(`file://${__dirname}/static/settings.html`);
    // No menu on the About settingsWindow
    settingsWin.setMenu(null);
    //settingsWin.webContents.openDevTools()
    settingsWin.once('ready-to-show', function() {
        settingsWin.show()
    })

    settingsWin.once('closed', function() {
        aboutWin = null
    })

    return settingsWin.show()
}