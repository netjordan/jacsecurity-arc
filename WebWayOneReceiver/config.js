var config = {};

// Log Configuration
config.logLevel = 'debug';

// WebWayOne RCT Details
config.webwayone = {};
config.webwayone.host = "127.0.0.1";
config.webwayone.port = 8080;

// AE Cluster config
config.cluster = {};

config.cluster.listenIP = '127.0.0.1';
config.cluster.listenPort = 2000;

config.cluster.servers = [
    { host: "localhost", port: 2000 },
    { host: "localhost", port: 2001 }
];

// Message Bus config
config.mqtt = {};
config.mqtt.host = "localhost";
config.mqtt.port = 1234;
config.mqtt.txTopic = "event/webwayone";
config.mqtt.ackTopic = "acknowledge/webwayone";

module.exports = config;