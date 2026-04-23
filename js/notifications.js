// notifications.js — reemplaza el contenido completo

const Notifications = (() => {

    // Solicitar permiso y suscribir al usuario cuando entra al chat
    async function requestPermission() {
        if (!window.OneSignal) return;
        try {
            await window.OneSignal.Notifications.requestPermission();
        } catch (e) {
            console.warn('OneSignal: no se pudo solicitar permiso', e);
        }
    }

    // Asignar un External ID al usuario (usa el UID de Firebase Auth)
    // Esto permite enviar notificaciones a un usuario específico
    async function setUserId(uid) {
        if (!window.OneSignal || !uid) return;
        try {
            await window.OneSignal.login(uid);
        } catch (e) {
            console.warn('OneSignal: no se pudo asignar user ID', e);
        }
    }

    // Etiquetar al usuario con el código de sala actual
    // Así OneSignal sabe a qué sala pertenece cada usuario
    async function setRoomTag(roomCode) {
        if (!window.OneSignal || !roomCode) return;
        try {
            await window.OneSignal.User.addTag('room', roomCode);
        } catch (e) {
            console.warn('OneSignal: no se pudo asignar tag de sala', e);
        }
    }

    // Limpiar la sala al salir del chat
    async function clearRoomTag() {
        if (!window.OneSignal) return;
        try {
            await window.OneSignal.User.removeTag('room');
        } catch (e) {
            console.warn('OneSignal: no se pudo limpiar tag', e);
        }
    }

    return { requestPermission, setUserId, setRoomTag, clearRoomTag };
})();