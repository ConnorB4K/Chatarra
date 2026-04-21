// CHATARRA Media Module
// Image compression (Canvas) & ImgBB Upload

const Media = (() => {
    const MAX_WIDTH = 1200;
    const MAX_HEIGHT = 1200;
    const QUALITY = 0.7; // 70% de calidad para balancear peso y nitidez
    const IMGBB_API_KEY = "3c7ef353cae8ffc2d117d866c7c499fe";

    /**
     * Comprime un archivo de imagen usando Canvas.
     * Retorna una Promesa que se resuelve con un Blob (el JPEG comprimido).
     */
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // Reducir la escala si es necesario
                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        if (width > height) {
                            height = Math.round((height * MAX_WIDTH) / width);
                            width = MAX_WIDTH;
                        } else {
                            width = Math.round((width * MAX_HEIGHT) / height);
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convertir el canvas a Blob JPEG
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('La compresión falló'));
                        }
                    }, 'image/jpeg', QUALITY);
                };
                img.onerror = () => reject(new Error('Fallo al cargar la imagen en Canvas'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Fallo al leer el archivo original'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Sube una imagen comprimida a ImgBB.
     * Retorna la URL pública de descarga.
     */
    async function uploadImage(roomCode, file) {
        try {
            // 1. Comprimir primero la imagen localmente
            const compressedBlob = await compressImage(file);

            // 2. Preparar los datos para la API de ImgBB
            const formData = new FormData();
            // Le pasamos el Blob comprimido con un nombre genérico
            formData.append("image", compressedBlob, "chat-image.jpg");

            // 3. Hacer la petición POST a ImgBB
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            // 4. Retornar la URL directa a la imagen si fue exitoso
            if (data.success) {
                return data.data.url;
            } else {
                throw new Error(data.error?.message || "Error devuelto por ImgBB");
            }
        } catch (error) {
            console.error("Error en uploadImage:", error);
            throw error;
        }
    }

    // Exponer públicamente las funciones
    return {
        compressImage,
        uploadImage
    };
})();