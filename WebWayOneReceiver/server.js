/*
 * Load config file
 */
var config = require('./config');

/*
 * Initialise logger
 */
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = config.logLevel || 'debug';

logger.info("Starting up. Log Level is " + logger.level);

/*
 * Array to store events temporarily
 */
var hash = require('json-hash');
var eventArray = [];

// remove items older than 30 seconds
setInterval(function() {
    logger.debug("Running cached event cleanup cycle");

    eventArray.forEach(function(event) {
        if (Date.now() - 30000 > event.createdAt) {
            logger.debug("Removing event as it has expired: " + JSON.stringify(event));
            var index = eventArray.indexOf(event);
            eventArray = eventArray.splice(index, 1);
        }
    });
}, 30000);

/*
 * Initalise connection to webwayone
 */
var net = require('net');
var WebWayClient = new net.Socket();

// connect to the alarm server
WebWayClient.connect(config.webwayone.port, config.webwayone.host, function() {
    logger.info('Successfully connected to webwayone server (' + config.webwayone.host + ':' + config.webwayone.port + ')');
});

/*
 * Event handlers
 */
WebWayClient.on('data', function(data) {
    logger.debug('Received: ' + data);

    xmlParser.parseString(data, function (err, result) {
        if (result.Packet) {
            result.Packet.Signal.forEach(function(signal) {
                var messageBusEvent = {};
                messageBusEvent.event_type = signal.$.EvType;
                messageBusEvent.alarm_no = signal.AlarmNo[0];
                messageBusEvent.event = signal.Event[0];

                logger.info("Decoded event: " + JSON.stringify(messageBusEvent));

                var storedEvent = {
                    "createdAt": Date.now(),
                    "hash": hash.digest(messageBusEvent),
                    "event": messageBusEvent
                };

                logger.debug("Adding event to memory");
                eventArray.push(storedEvent);

                // TODO: make ackseq persistent
                logger.info("Acknowledging alarm");
                WebWayClient.write('<?xml version="1.0" encoding="UTF-8"?><Ack AlarmNo="' + messageBusEvent.alarm_no + '" ID="' + result.Packet.$.ID + '" AckSeq="014E65F22A17"></Ack>');
            });
        } else if (typeof result.Heartbeat !== 'undefined') {
            logger.debug("Received heartbeat");
            // TODO: make ackseq persistent
            logger.debug("Responding to heartbeat");
            WebWayClient.write('<?xml version="1.0" encoding="UTF-8"?><Ack AckSeq="014E65F22A17"></Ack>');
        }
    });
});

WebWayClient.on('close', function() {
    logger.error('Disconnected from webwayone server (' + config.webwayone.host + ':' + config.webwayone.port + ')');
});

WebWayClient.on('error', function(data) {
    logger.error(data.message)
});

/*
 * Initalise cluster server
 */

var clusterServer = net.createServer();
clusterServer.on('connection', clusterHandleConnection);

clusterServer.listen(config.cluster.listenPort, function() {
    logger.info('Cluster server started on port ' + config.cluster.listenPort);
});

function clusterHandleConnection(connection) {
    var remoteAddress = connection.remoteAddress + ':' + connection.remotePort;
    logger.debug('Cluster: new client connection from %s', remoteAddress);

    connection.on('data', onConnData);

    function onConnData(data) {
        logger.debug('Cluster: connection data from %s: %j', remoteAddress, data);

        var checkRegex = new RegExp("^(CHECK) ([a-zA-Z0-9]{10,})");

        if (checkRegex.test(data)) {
            var parts = checkRegex.exec(data);
            logger.debug("Cluster: received CHECK command");

            eventArray.forEach(function(event) {
               if (event.hash == parts[2]) {
                   logger.debug("Found matched event");
                   connection.write("MATCHED " + parts[2]);
               }
            });
        }

        var pingRegex = new RegExp("^(PING) ([a-zA-Z0-9]{10,})");

        if (pingRegex.test(data)) {
            var parts = pingRegex.exec(data);
            logger.debug("Cluster: received PING (" + parts[2] + ")");

            logger.debug("Cluster: responding to PING with PONG (" + parts[2] + ")");
            connection.write("PONG " + parts[2]);
        }

    }
}

/*
 * Initalise xml parser
 */
var xml2js = require('xml2js')
var xmlParser = new xml2js.Parser;

/*
 * Misc functions
 */
var fs = require('fs');

function getNextSeqNo() {
    // read the sequence number
    fs.writeFile('seqno', "", function() {

    });
}

