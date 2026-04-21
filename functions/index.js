/* ============================================
   CHATARRA — Cloud Function
   Push notification on new message
   ============================================ */

const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

/**
 * Triggered when a new message is created in any room.
 * Sends push notifications to all other members of the room.
 */
exports.onMessageCreated = onValueCreated(
  {
    ref: '/rooms/{roomCode}/messages/{messageId}',
    region: 'us-central1',
  },
  async (event) => {
    const message = event.data.val();
    const roomCode = event.params.roomCode;
    const senderUid = message.uid;
    const senderNickname = message.nickname || 'Alguien';

    // Build notification body based on message type
    let body;
    switch (message.type) {
      case 'text':
        body = message.content.length > 100
          ? message.content.substring(0, 100) + '...'
          : message.content;
        break;
      case 'image':
        body = 'Envió una imagen';
        break;
      case 'sticker':
        body = 'Envió un sticker';
        break;
      case 'audio':
        body = 'Envió un audio';
        break;
      default:
        body = 'Nuevo mensaje';
    }

    // Get all members of the room
    const db = getDatabase();
    const membersSnapshot = await db.ref(`rooms/${roomCode}/members`).once('value');
    const members = membersSnapshot.val();

    if (!members) return null;

    // Collect FCM tokens of all members except the sender
    const tokens = [];
    Object.entries(members).forEach(([uid, memberData]) => {
      if (uid !== senderUid && memberData.fcmToken) {
        tokens.push(memberData.fcmToken);
      }
    });

    if (tokens.length === 0) return null;

    // Send notification to all tokens
    const messaging = getMessaging();
    const notification = {
      notification: {
        title: `${senderNickname} (${roomCode})`,
        body: body,
      },
      data: {
        roomCode: roomCode,
        senderUid: senderUid,
        type: message.type,
      },
      tokens: tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(notification);
      console.log(
        `Notifications sent: ${response.successCount} success, ${response.failureCount} failures`
      );

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              tokensToRemove.push(tokens[idx]);
            }
          }
        });

        // Remove invalid tokens from the database
        if (tokensToRemove.length > 0) {
          const updates = {};
          Object.entries(members).forEach(([uid, memberData]) => {
            if (tokensToRemove.includes(memberData.fcmToken)) {
              updates[`rooms/${roomCode}/members/${uid}/fcmToken`] = null;
            }
          });
          await db.ref().update(updates);
          console.log(`Removed ${tokensToRemove.length} invalid tokens`);
        }
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }

    return null;
  }
);
