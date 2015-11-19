#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    log = require('verbalize'),
    colors = require('colors'),
    nconf = require('nconf'),
    mkdirp = require('mkdirp'),
    nowplaying = require('nowplaying'),
    request = require('request');

var itunes = require('./lib/itunes'),
    spotify = require('./lib/spotify'),
    apps = [itunes, spotify],
    defaultConfigFilePath;

// -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
// SETUP

// Fetch default configuration path from process environment
nconf.env(['HOME', 'NODE_ENV']);
defaultConfigFilePath = path.normalize(path.join(nconf.get('HOME'), '.config', 'slack-audio', 'config.json'));
mkdirp.sync(path.dirname(defaultConfigFilePath));

// Add conf file as 1st hierarchy for nconf
nconf.use('file', { file: defaultConfigFilePath });
console.log(('Using slack-audio configuration: ' + defaultConfigFilePath).yellow);

// Add argv as 2nd hierarchy for nconf
nconf.argv({
    'user': {
        alias: 'u',
        describe: 'User to report as poster in Slack channel.',
        default: (nconf.get('slack:user') || 'Unknown Maxrelaxer')
    },
    'channel': {
        alias: 'c',
        describe: 'Slack channel to post song playing changes to.',
        default: (nconf.get('slack:channel') || '#relaxbot')
    },
    'bot': {
        alias: 'b',
        describe: 'Name of the bot that posts to Slack channel.',
        default: (nconf.get('slack:bot') || 'Jams Bot')
    },
    'url': {
        alias: 'w',
        describe: 'Webhooks URL found on the Slack custom integrations page.',
        demand: (!nconf.get('slack:url')),
        default: (nconf.get('slack:url') || null)
    },
    'save': {
        alias: 's',
        describe: 'Bool on whether to save argv options to config file (default: false)',
        default: false
    }
});

// Allow argv to override existing prefs
nconf.set('slack:user', nconf.get('user'));
nconf.set('slack:channel', nconf.get('channel'));
nconf.set('slack:bot', nconf.get('bot'));
if (nconf.get('url') !== null) nconf.set('slack:url', nconf.get('url'));

// Save only if -s flag passed
if (nconf.get('save')) saveConfig();

// -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
// App

var currentTrack,
    message,
    payload;

payload = {
    'username': 'MusicBot',
    'text': null
};

// Listen to nowplaying events

nowplaying.on("playing", onPlaying);
nowplaying.on("paused", onPaused);


// -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --

function getFormattedMessage(data) {
    for (var i in apps) {
        if (apps[i].name === data.source) {
            return apps[i].getMessage(nconf.get('slack:user'), data);
        }
    }
    return null;
}

function onPlaying(data) {
    message = getFormattedMessage(data);
    console.log("PLAYING!".green);
    console.log("[message to post]".green);
    console.log(message.yellow);

    payload['text'] = message;

    if (message && message != currentTrack) {
	request.post({
            url: nconf.get('slack:url'),
            json: true,
            body: payload
        }, function(err, resp, body) {
            if (err) console.error(err);
            if (resp && body) {
            		console.log(("Slack Says: " + body).green);
                currentTrack = message;
            }
        })
    }
}

function onPaused(data) {
    console.log("PAUSED!".yellow, data);
}

function saveConfig() {
    nconf.save(function (err) {
        if (err) {
            console.error('Error saving slack-audio conf file.'.red);
            throw err;
        }

        console.log('Saved nconf file successfully!'.green);

        fs.readFile(defaultConfigFilePath, function (err, data) {
            if (err) throw err;
            console.log('[Current Config]'.grey);
            console.dir(JSON.parse(data.toString()));
        });
    });
}


// Verbalize `runner`
// log.runner = 'nowplaying-slack';
