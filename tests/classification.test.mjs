import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest } from '../src/shared/http/primitives.js';

test('media: extensionless Emby/Jellyfin endpoints bypass ordinary API policy', () => {
  for (const path of [
    '/Videos/123/stream', '/emby/Videos/123/original',
    '/Audio/123/stream', '/emby/Audio/123/universal',
    '/Audio/123/original/', '/Items/123/Download', '/Items/123/File',
    '/VIDEOS/123/STREAM', '/Videos/123/stream.ts',
  ]) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal(classifyRequest(path, method), 'streaming', `${method} ${path}`);
    }
  }
});

test('media: whole stream and playlist/segment endpoints are distinct', () => {
  for (const path of ['/Videos/123/master.m3u8', '/Audio/123/master.m3u8', '/dash/main.mpd']) {
    assert.equal(classifyRequest(path, 'GET'), 'manifest', path);
  }
  for (const path of ['/Videos/123/stream/hls/1.ts', '/Audio/123/universal/hls/1.m4s', '/hls/123.ts']) {
    assert.equal(classifyRequest(path, 'GET'), 'segment', path);
  }
});

test('media: standalone audio streams are not ordinary requests', () => {
  for (const ext of ['mp3', 'aac', 'flac', 'ogg', 'opus', 'wav', 'm4a']) {
    assert.equal(classifyRequest(`/music/track.${ext}`, 'GET'), 'streaming', ext);
  }
});

test('media: metadata/subtitles/images do not become media merely by parent path', () => {
  for (const [path, expected] of [
    ['/Audio/123/Lyrics', 'other'],
    ['/Videos/123/stream/settings', 'other'],
    ['/emby/Items/123', 'api'],
    ['/Items/123/PlaybackInfo', 'playback_info'],
    ['/Videos/123/Subtitles/1/stream.vtt', 'subtitle'],
    ['/Videos/123/Images/Primary', 'image'],
    ['/Videos/123/stream.js', 'static'],
  ]) assert.equal(classifyRequest(path, 'GET'), expected, path);
});
