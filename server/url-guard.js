'use strict';

function normalizeHost(host) {
  const value = String(host || '');
  const bare = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return bare.replace(/\.$/, '');
}

function isPrivateHost(host) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|0\.0\.0\.0|::|fc00:|fd[0-9a-f]{2}:|fe80:|169\.254\.)/i.test(normalizeHost(host));
}

function isMetadataEndpoint(host) {
  return /^(169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)$/i.test(normalizeHost(host));
}

function isBlockedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!/^https?:$/.test(u.protocol)) return true;
    if (isPrivateHost(u.hostname)) return true;
    if (isMetadataEndpoint(u.hostname)) return true;
    return false;
  } catch { return true; }
}

module.exports = { isPrivateHost, isMetadataEndpoint, isBlockedUrl };
