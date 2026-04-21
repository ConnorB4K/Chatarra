/* ============================================
   CHATARRA — Media Module
   Image compression (Canvas) + Firebase Storage
   ============================================ */

const Media = (() => {
  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 1200;
  const QUALITY = 0.7;

  /**
   * Compress an image file using Canvas.
   * Returns a Blob of the compressed JPEG.
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // Scale down if needed
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
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Compression failed'));
              }
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
   * Upload a compressed image to Firebase Storage.
   * Returns the download URL.
   */
  async function uploadImage(roomCode, file) {
    // Compress first
    const compressed = await compressImage(file);

    // Generate unique filename
    const ext = 'jpg';
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const path = `rooms/${roomCode}/images/${filename}`;

    const storageRef = firebase.storage().ref(path);
    const snapshot = await storageRef.put(compressed, {
      contentType: 'image/jpeg',
    });

    const downloadURL = await snapshot.ref.getDownloadURL();
    return downloadURL;
  }

  return {
    compressImage,
    uploadImage,
  };
})();
