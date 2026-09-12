import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';

const limits = { minimumSeconds: 120, maximumSeconds: 240, minimumShortEdge: 720, minimumLongEdge: 1280 };
const manualChecks = [
  'Listen to the full export: audio presence does not prove audible, intelligible human narration or the absence of music.',
  'Watch the full export for readable text, actual motion, missing sections, honest mode labels and accurate product claims.',
  'Verify final submission requirements and the eventual upload separately. This tool does not upload or modify the file.',
];

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateMetadata(metadata) {
  const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
  const videos = streams.filter((stream) => stream.codec_type === 'video' && Number(stream.disposition?.attached_pic ?? 0) !== 1);
  const video = videos.find((stream) => Number(stream.disposition?.default ?? 0) === 1) ?? videos[0] ?? null;
  const audio = streams.filter((stream) => stream.codec_type === 'audio');
  const duration = finiteNumber(metadata?.format?.duration);
  const width = finiteNumber(video?.width), height = finiteNumber(video?.height);
  const dimensionsKnown = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
  const checks = [
    { name: 'File duration is 120–240 seconds inclusive', passed: duration !== null && duration >= limits.minimumSeconds && duration <= limits.maximumSeconds,
      detail: duration === null ? 'ffprobe did not report a finite container duration; cannot verify the duration rule.' : `${duration.toFixed(3)} seconds` },
    { name: 'A non-cover video stream is present', passed: video !== null,
      detail: video ? `Stream ${video.index ?? '?'} (${video.codec_name ?? 'codec not reported'})` : 'No video stream, or only an attached cover image.' },
    { name: 'Video dimensions meet the 1280×720 envelope', passed: Boolean(dimensionsKnown && Math.min(width, height) >= limits.minimumShortEdge && Math.max(width, height) >= limits.minimumLongEdge),
      detail: dimensionsKnown ? `${width}×${height} encoded pixels; orientation does not affect this check.` : 'Usable video dimensions were not reported.' },
    { name: 'An audio stream is present', passed: audio.length > 0,
      detail: audio.length ? `${audio.length} audio stream(s). Presence does not establish speech, audibility or intelligibility.` : 'No audio stream was found.' },
  ];
  return {
    metadataChecksPassed: checks.every((check) => check.passed), limits, durationSeconds: duration,
    selectedVideo: video ? { index: video.index ?? null, codec: video.codec_name ?? null, width, height, durationSeconds: finiteNumber(video.duration) } : null,
    audioStreams: audio.map((stream) => ({ index: stream.index ?? null, codec: stream.codec_name ?? null, channels: stream.channels ?? null, sampleRate: stream.sample_rate ?? null })),
    checks, manualChecksRequired: manualChecks,
    qualification: 'Metadata checks only. This is not certification of human narration, intelligibility, visual quality, truthful content or finalist eligibility.',
  };
}

function selfTest() {
  const fixture = () => ({ format: { duration: '165' }, streams: [
    { index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, disposition: { default: 1, attached_pic: 0 } },
    { index: 1, codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: '48000' },
  ] });
  let cases = 0;
  for (const [duration, expected] of [['120', true], ['165', true], ['240', true], ['119.999', false], ['240.001', false], ['0', false], ['N/A', false], [undefined, false]]) {
    const metadata = fixture(); metadata.format.duration = duration;
    assert.equal(validateMetadata(metadata).metadataChecksPassed, expected); cases += 1;
  }
  for (const [width, height, expected] of [[1280, 720, true], [720, 1280, true], [1920, 1080, true], [1280, 719, false], [1279, 720, false], [0, 1080, false]]) {
    const metadata = fixture(); metadata.streams[0].width = width; metadata.streams[0].height = height;
    assert.equal(validateMetadata(metadata).metadataChecksPassed, expected); cases += 1;
  }
  const noAudio = fixture(); noAudio.streams.pop(); assert.equal(validateMetadata(noAudio).metadataChecksPassed, false); cases += 1;
  const coverOnly = fixture(); coverOnly.streams[0].disposition.attached_pic = 1; assert.equal(validateMetadata(coverOnly).metadataChecksPassed, false); cases += 1;
  const withCover = fixture(); withCover.streams.unshift({ index: 2, codec_type: 'video', width: 64, height: 64, disposition: { attached_pic: 1 } }); assert.equal(validateMetadata(withCover).metadataChecksPassed, true); cases += 1;
  assert.equal(validateMetadata({}).metadataChecksPassed, false); cases += 1;
  return cases;
}

function usage() {
  console.log('Usage: node scripts/check-demo.mjs [--json] [--] /path/to/video.mp4\n       node scripts/check-demo.mjs --self-test\n\nChecks local ffprobe metadata for 2–4 minutes, at least a 1280×720 video envelope, and an audio stream.\nHuman narration, audio clarity and content must be checked manually. No upload or file mutation.');
}

let jsonOutput = false, file = null, literal = false;
for (const arg of process.argv.slice(2)) {
  if (!literal && arg === '--') { literal = true; continue; }
  if (!literal && (arg === '--help' || arg === '-h')) { usage(); process.exit(0); }
  if (!literal && arg === '--self-test') {
    if (process.argv.slice(2).length !== 1) { console.error('--self-test must be used alone; it does not validate a recording.'); process.exit(2); }
    const cases = selfTest();
    console.log(`PASS ${cases} in-memory metadata cases. No video or audio was created, probed or validated.`);
    process.exit(0);
  }
  if (!literal && arg === '--json') { jsonOutput = true; continue; }
  if ((!literal && arg.startsWith('-')) || file !== null) { console.error('Provide one local file, with optional --json. Use -- before a filename beginning with a hyphen.'); process.exit(2); }
  file = arg;
}
if (!file) { usage(); process.exit(2); }

try {
  const absolute = path.resolve(file);
  if (!statSync(absolute).isFile()) throw new Error('The input must be a regular local file.');
  let raw;
  try {
    raw = execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_streams', '-show_format', '-of', 'json', '-i', absolute],
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('ffprobe is not installed or is not on PATH. Install FFmpeg/ffprobe, then rerun on the actual export.');
    if (error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT') throw new Error('ffprobe did not finish within 30 seconds. No compliance result was established.');
    throw new Error('ffprobe could not inspect this local file. Confirm the export is complete and opens in a media player. No compliance result was established.');
  }
  const result = { file: absolute, inspectedAt: new Date().toISOString(), ...validateMetadata(JSON.parse(raw)) };
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`File: ${absolute}`);
    for (const check of result.checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
    console.log(result.metadataChecksPassed ? '\nFile metadata passes. Manual review is still required.' : '\nFile metadata does not meet all checked requirements.');
    for (const item of result.manualChecksRequired) console.log(`MANUAL ${item}`);
    console.log(result.qualification);
  }
  process.exitCode = result.metadataChecksPassed ? 0 : 1;
} catch (error) {
  const result = { metadataChecksPassed: false, error: error instanceof Error ? error.message : String(error), manualChecksRequired: manualChecks };
  if (jsonOutput) console.error(JSON.stringify(result, null, 2));
  else console.error(`Unable to validate: ${result.error}`);
  process.exitCode = 2;
}
