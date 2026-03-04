import { Server, Socket } from 'socket.io';
import logger from '../../utils/logger';

function getRoomId(instructorId: string, studentId: string) {
    const ids = [`instructor_${instructorId}`, `student_${studentId}`].sort();
    return ids.join("_");
}

export const registerChatHandlers = (io: Server, socket: Socket) => {
    socket.on("join_room", ({ instructorId, studentId }) => {
        const roomId = getRoomId(instructorId, studentId);
        socket.join(roomId);
        logger.info(`✅ Client ${socket.id} joined room: ${roomId}`);
    });

    socket.on("server_message_send", (data) => {
        const { conversationId, messageId, content, senderId, peerId, senderRole } = data;
        let roomId;
        if (senderRole === 'instructor') {
            roomId = getRoomId(senderId, peerId);
        } else {
            roomId = getRoomId(peerId, senderId);
        }
        logger.info(`💬 Message from ${data.senderId} in ${roomId}: ${data.content}`);
        io.to(roomId).emit("receive_message", {
            senderId: senderId,
            message: content,
            createdAt: Date.now(),
            instructorId: senderRole === 'instructor' ? senderId : peerId,
            studentId: senderRole !== 'instructor' ? senderId : peerId,
            senderRole: senderRole,
            messageId: messageId,
            conversationId: conversationId
        });
    });

    socket.on("server_message_read", (data) => {
        const { conversationId, senderId, peerId } = data;
        const roomId = getRoomId(senderId, peerId);
        logger.info(`${data.peerId} read it`);
        io.to(roomId).emit("message_read", {
            conversationId,
            senderId,
            peerId
        })
    })

    socket.on("server_last_message_update", (data) => {
        const { conversationId, messageId, content, senderId, peerId, senderRole } = data;
        let roomId;
        if (senderRole === 'instructor') {
            roomId = getRoomId(senderId, peerId);
        } else {
            roomId = getRoomId(peerId, senderId)
        }
        io.to(roomId).emit("last_message_update", {
            conversationId,
            messageId,
            content,
        })
    })

    socket.on("server_message_update", (data) => {
        const { conversationId, messageId, content, senderId, peerId, senderRole } = data;
        let roomId;
        if (senderRole === 'instructor') {
            roomId = getRoomId(senderId, peerId);
        } else {
            roomId = getRoomId(peerId, senderId)
        }
        io.to(roomId).emit("message_update", {
            conversationId,
            messageId,
            content,
        })
    })

    socket.on("server_message_delete", (data) => {
        const { conversationId, messageId, instructorId, studentId } = data;
        const roomId = getRoomId(instructorId, studentId);

        logger.info(`🗑️ Message ${messageId} deleted in ${roomId}`);
        io.to(roomId).emit("message_delete", {
            conversationId,
            messageId,
        });
    });

    socket.on("server_message_delete_last", (data) => {
        const { conversationId, deletedMessageId, newLastMessage, instructorId, studentId } = data;
        const roomId = getRoomId(instructorId, studentId);

        logger.info(`⚠️ Last message deleted in ${roomId}`);
        io.to(roomId).emit("message_delete_last", {
            conversationId,
            deletedMessageId,
            newLastMessage,
        });
    });

    socket.on("disconnect", () => {
        logger.info(`❌ User disconnected: ${socket.id}`);
    });
}