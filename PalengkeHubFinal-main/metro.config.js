// metro.config.js — required for Expo 54 Metro web bundler
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Metro web bundler
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;