const electron = require('electron')
const { ipcMain } = electron
const randomstring = require('randomstring')
const request = require('request')
const _ = require('underscore')
const eSettings = require('electron-settings')
var DigitalOcean = require('do-wrapper').default
const http = require('http');

const notifier = require("node-notifier");


var task = function(win, info, settings, no, callback) {
    var sender = win.webContents;
    var ssh_key_id = null;
    var id = null;
    var stopped = false;

    api = new DigitalOcean(eSettings.getSync('do_api_key'), '9999')
    var host = null;

    if(info.port === undefined){
        info.port = '8080'
    } 

    ipcMain.on('stopTasks', function(event) {
        if (stopped == false) {
            sender.send('updateMonitor', {
                no: no,
                msg: 'Cancelled',
                username: info.username,
                password: info.password,
                ip: 'n/a',
                error: true
            });
            stopped = true
        }
    });

    sender.send('updateMonitor', {
        no: no,
        msg: 'Started',
        username: info.username,
        password: info.password,
        ip: 'n/a',
        error: false
    });

    var key = 0
    createDroplet();
    function createDroplet() {
        api.accountGetKeys({}, function(err, resp, body) {
            if (err) {
                sender.send('updateMonitor', {
                    no: no,
                    msg: 'An error occured while fetching your SSH Keys.',
                    username: info.username,
                    password: info.password,
                    ip: 'n/a',
                    error: true
                })
                console.log(`[${no}] Error w ssh key`);
            }
            setTimeout(function() {
            
            function waitForResp(){
                if(typeof body !== "undefined"){
                    
                }
                else{
                    setTimeout(waitForResp, 250);
                }
            }

            if (body.ssh_keys[0] === undefined)
                var key =  null;
            else
                var key = body.ssh_keys[0].fingerprint
            console.log(key)

            sender.send('updateMonitor', {
                no: no,
                msg: `Getting SSH Key...`,
                username: info.username,
                password: info.password,
                ip: 'n/a',
                error: false
            });




            setTimeout(function() {



                var dropletName = 'proxy-' + randomstring.generate(9) + '-pd';
                var dropletData = {
                    name: dropletName,
                    region: info.region,
                    size: 's-1vcpu-1gb',
                    image: 'debian-10-x64',
                    ssh_keys: key,
                    monitoring: true,
                    user_data:
                      '#!/bin/bash \n' +
                      'sudo apt-get install squid wget apache2-utils -y \n' +
                      `sudo htpasswd -b -c /etc/squid/passwd proxydrip ${info.password} \n` +
                      'wget -O /etc/squid/squid.conf https://raw.githubusercontent.com/mikelucid15/proxydrip/main/squid.conf --no-check-certificate \n' +
                      'systemctl restart squid.service && systemctl enable squid.service \n' +
                      `iptables -I INPUT -p tcp --dport ${info.port} -j ACCEPT \n` +
                      'iptables-save'
                };
                sender.send('updateMonitor', {
                    no: no,
                    msg: `Creating Droplet...`,
                    username: info.username,
                    password: info.password,
                    ip: 'n/a',
                    error: false
                });


                console.log(dropletData);

                api.dropletsCreate(dropletData, function(err, resp, body) {
                    if (err) {
                        sender.send('updateMonitor', {
                            no: no,
                            msg: 'An error occured while trying to create your droplet.',
                            username: info.username,
                            password: info.password,
                            ip: 'n/a',
                            error: true,
                            
                        });
                        notifier.notify({
                            message: "Please check your settings and try again",
                            title: `[${no}] Error creating droplet.`,
                            sound: true,//"Bottle",
                            icon :`${__dirname}/logo.png`,
                            wait:false
                        })
                        console.log(`[${no}] Error creating droplet.`);
                        console.log(err);
                        return callback(null, true);
                    }

                    setTimeout(function() {

                        if (stopped) {
                            destroyDroplet(id, api, function(err, resp) {
                                if (err) {
                                    return callback(null, true);
                                }
                                return callback(null, true);
                            });
                        }

                        api.dropletsGetAll({}, function(err, resp, body) {

                            id = _.findWhere(resp.body.droplets, {
                                name: dropletName
                            }).id

                            host = _.findWhere(resp.body.droplets, {
                                name: dropletName
                            }).networks.v4[1].ip_address

                            var para = null;

                            if (eSettings.getSync('ssh_passphrase') != null) {
                                para = eSettings.getSync('ssh_passphrase');
                            }

                            if (stopped) {
                                destroyDroplet(id, api, function(err, resp) {
                                    if (err) {
                                        return callback(null, true);
                                    }
                                    return callback(null, true);
                                });
                            } else {
                                sender.send('updateMonitor', {
                                    no: no,
                                    msg: `Droplet Created.`,
                                    username: info.username,
                                    password: info.password,
                                    ip: host,
                                    port: info.port,
                                    error: false
                                });
                                notifier.notify({
                                    message: "Host: "+host+"\nport:"+info.port+"\nUsername: "+info.username+"\nPassword: "+info.password,
                                    title: `[${no}] Droplet Created.`,
                                    sound: true,//"Bottle",
                                    icon :`${__dirname}/logo.png`,
                                    wait:false
                                })
                            }

                                console.log("http://" + info.username + ":" + info.password + "@" + host + ":" + info.port)


                                var count = 29;
                                for (var i = 0; i < 29; i++) {

                                  setTimeout(function() {
                                    sender.send('updateMonitor', {
                                        no: no,
                                        msg: `Testing Proxy in ${count}s`,
                                        username: info.username,
                                        password: info.password,
                                        ip: host,
                                        port: info.port,
                                        error: false
                                    });
                                    count--;

                                    if(count < 1){
                                        setTimeout(function() {
                                            sender.send('updateMonitor', {
                                                no: no,
                                                msg: `Testing in Progress`,
                                                username: info.username,
                                                password: info.password,
                                                ip: host,
                                                port: info.port,
                                                error: false
                                            });
                                            notifier.notify({
                                                message: "Building Proxy Server... \nTesting the proxy...\nhttp://" + info.username + ":" + info.password + "@" + host + ":" + info.port,
                                                title: `[${no}] Testing in Progress`,
                                                sound: true,
                                                icon :`${__dirname}/logo.png`,
                                                wait:false
                                            })
                                        })
                                    } 
                                  }, 1000*i);

                                }


                                setTimeout(function() {
                                    var auth = info.username+":"+info.password;
                                    console.log(host,+" "+info.port+" "+auth)
                                    var opts = {
                                        host: host,
                                        port: info.port,
                                        path: "http://www.google.com",
                                        auth: auth,
                                        headers: {
                                             Host: "www.google.com"
                                          }
                                    }
                                    request.get(opts, (error, resp, body) => {  

                                            if (err) {
                                                console.log(err);
                                                sender.send('updateMonitor', {
                                                    no: no,
                                                    msg: `Proxy Invalid, destroying droplet.`,
                                                    username: info.username,
                                                    password: info.password,
                                                    ip: host,
                                                    port: info.port,
                                                    error: true
                                                });
                                                notifier.notify({
                                                    message: "Proxy Invalid, destroying droplet.",
                                                    title: err,
                                                    sound: true,//"Bottle",
                                                    icon : `${__dirname}/logo.png`,
                                                    wait:false
                                                })

                                                destroyDroplet(id, api, function(err, resp) {
                                                    if (err) {
                                                        sender.send('updateMonitor', {
                                                            no: no,
                                                            msg: `Error Occured while destroying droplet due to bad proxy Connection.`,
                                                            username: info.username,
                                                            password: info.password,
                                                            ip: host,
                                                            port: info.port,
                                                            error: true
                                                        });
                                                        return callback(null, true);
                                                    }

                                                    sender.send('updateMonitor', {
                                                        no: no,
                                                        msg: `Droplet Destroyed due to bad proxy connection.`,
                                                        username: info.username,
                                                        password: info.password,
                                                        ip: host,
                                                        port: info.port,
                                                        error: true
                                                    });
                                                    notifier.notify({
                                                        message: "Droplet Destroyed due to bad proxy connection, during final test.",
                                                        title: `[${no}] Droplet Destoryed`,
                                                        sound: true,//"Bottle",
                                                        icon :`${__dirname}/logo.png`,
                                                        wait:false
                                                    })

                                                    return callback(null, true);

                                                });

                                            } else {
                                                sender.send('updateMonitor', {
                                                    no: no,
                                                    msg: `Created!`,
                                                    username: info.username,
                                                    password: info.password,
                                                    port: info.port,
                                                    ip: host,
                                                    error: false
                                                });
                                                notifier.notify({
                                                    message: "Dropley ceated, proxy tested and is ready for use!",
                                                    title: `[${no}] Proxy Created!`,
                                                    sound: true,//"Bottle",
                                                    icon :`${__dirname}/logo.png`,
                                                    wait:false
                                                })

                                                return callback(null, true);
                                            }

                                        });
                        

                                }, 30000);

                            });


                        }, 5000);
                    
                });

            }, 5000);

        });
        
    })
}

}

function destroyDroplet(id, api, cb) {
    api.dropletsDelete(id, function(err, resp, body) {
        if (err) {
            return cb(true, null);
        }
        return cb(null, true)
    });
}

module.exports = {
    task: task
};
