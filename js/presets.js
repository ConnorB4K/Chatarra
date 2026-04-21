/* ============================================
   CHATARRA — Presets Module
   Dynamic stickers & audio from manifest.json
   ============================================ */

const Presets = (() => {
  let _stickers = [];
  let _audioPresets = [];

  /**
   * Load presets from manifest files.
   * Falls back to empty arrays if manifests don't exist.
   */
  async function init() {
    _stickers = await _loadManifest('./assets/stickers/manifest.json');
    _audioPresets = await _loadManifest('./assets/audio/manifest.json');
  }

  /**
   * Fetch a manifest.json and convert filenames to preset objects.
   */
  async function _loadManifest(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const files = await response.json();
      if (!Array.isArray(files)) return [];
      return files.map((file) => ({
        id: _fileToId(file),
        name: _fileToName(file),
        file: file,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Derive an ID from filename (lowercase, no extension).
   */
  function _fileToId(filename) {
    return filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Derive a display name from filename.
   * Removes extension, replaces - and _ with spaces, capitalizes words.
   */
  function _fileToName(filename) {
    const raw = filename.replace(/\.[^.]+$/, '');
    return raw
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Get sticker asset path.
   */
  function getStickerPath(filename) {
    return `./assets/stickers/${filename}`;
  }

  /**
   * Get audio asset path.
   */
  function getAudioPath(filename) {
    return `./assets/audio/${filename}`;
  }

  function getStickers() {
    return _stickers;
  }

  function getAudioPresets() {
    return _audioPresets;
  }

  function findSticker(file) {
    return _stickers.find((s) => s.file === file) || null;
  }

  function findAudio(file) {
    return _audioPresets.find((a) => a.file === file) || null;
  }

  return {
    init,
    getStickers,
    getAudioPresets,
    getStickerPath,
    getAudioPath,
    findSticker,
    findAudio,
  };
})();
