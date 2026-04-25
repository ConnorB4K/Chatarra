/* ============================================
   CHATARRA — Media Module
   Image compression + ImgBB upload
   ============================================ */

const Media = (() => {
  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 1200;
  const QUALITY = 0.7;

  let _apiKey = null;

  /**
   * Initialize with ImgBB API key.
   */
  function init(apiKey) {
    _apiKey = apiKey;
  }

  /**
   * Compress an image file using Canvas.
   * Returns a Blob of the compressed JPEG.
   */
  function _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            },
            'image/jpeg',
            QUALITY
          );
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert Blob to base64 string (without the data URI prefix).
   */
  function _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Compress and upload an image to ImgBB.
   * Returns the public URL.
   */
  const EXPIRATION_SECONDS = 864000;

  async function uploadImage(file) {
    if (!apiKey) throw new Error('ImgBB API key not configured');

    let base64;

    if (file.type === 'image/gif') {
      // Los GIFs NO se comprimen: el canvas destruye la animación
      base64 = await blobToBase64(file);
    } else {
      // Imágenes estáticas: comprimir normalmente
      const compressed = await compressImage(file);
      base64 = await blobToBase64(compressed);
    }

    const formData = new FormData();
    formData.append('key', _apiKey);
    formData.append('image', base64);
    formData.append('expiration', EXPIRATION_SECONDS);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      return data.data.display_url;
    } else {
      throw new Error(data.error?.message ?? 'Upload failed');
    }
  }

  /**
   * Check if ImgBB is configured.
   */
  function isConfigured() {
    return _apiKey && _apiKey !== 'YOUR_IMGBB_API_KEY';
  }

  return {
    init,
    uploadImage,
    isConfigured,
  };
})();