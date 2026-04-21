/* ============================================
   CHATARRA — Presets Module
   Stickers & Audio presets (static assets)
   ============================================ */

const Presets = (() => {
  /**
   * Sticker definitions.
   * Images live in ./assets/stickers/
   * Only the filename is stored in Firebase.
   */
  const STICKERS = [
    { id: 'laugh', name: 'Risa', file: 'laugh.webp' },
    { id: 'thumbsup', name: 'Aprobado', file: 'thumbsup.webp' },
    { id: 'heart', name: 'Corazón', file: 'heart.webp' },
    { id: 'cry', name: 'Llorar', file: 'cry.webp' },
    { id: 'wow', name: 'Sorpresa', file: 'wow.webp' },
    { id: 'angry', name: 'Enojo', file: 'angry.webp' },
  ];

  /**
   * Audio preset definitions.
   * Audio files live in ./assets/audio/
   * Only the filename is stored in Firebase.
   */
  const AUDIO_PRESETS = [
    { id: 'risas', name: 'Risas', file: 'risas.mp3' },
    { id: 'aplausos', name: 'Aplausos', file: 'aplausos.mp3' },
    { id: 'suspense', name: 'Suspense', file: 'suspense.mp3' },
  ];

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

  /**
   * Get all stickers.
   */
  function getStickers() {
    return STICKERS;
  }

  /**
   * Get all audio presets.
   */
  function getAudioPresets() {
    return AUDIO_PRESETS;
  }

  /**
   * Find sticker by filename.
   */
  function findSticker(file) {
    return STICKERS.find((s) => s.file === file) || null;
  }

  /**
   * Find audio preset by filename.
   */
  function findAudio(file) {
    return AUDIO_PRESETS.find((a) => a.file === file) || null;
  }

  return {
    getStickers,
    getAudioPresets,
    getStickerPath,
    getAudioPath,
    findSticker,
    findAudio,
  };
})();
