const rooms = {};

function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on("join-room", ({ roomId, userName, userId }) => {
      socket.join(roomId);

      if (!rooms[roomId]) rooms[roomId] = { participants: [] };

      const participant = { socketId: socket.id, userId, userName, muted: false, camOff: false };
      rooms[roomId].participants.push(participant);

      // Tell others someone joined
      socket.to(roomId).emit("user-joined", { participant });

      // Send existing participants to new joiner
      socket.emit("room-state", {
        participants: rooms[roomId].participants.filter((p) => p.socketId !== socket.id),
      });

      console.log(`👤 ${userName} joined room ${roomId}`);
    });

    // ---- WebRTC signaling relay (mesh) ----
    // Client sends messages targeted at a specific peer (by socketId).
    socket.on("webrtc-offer", ({ roomId, toSocketId, fromUserId, sdp }) => {
      if (!roomId || !toSocketId || !sdp) return;
      socket.to(toSocketId).emit("webrtc-offer", {
        roomId,
        fromSocketId: socket.id,
        fromUserId,
        sdp,
      });
    });

    socket.on("webrtc-answer", ({ roomId, toSocketId, fromUserId, sdp }) => {
      if (!roomId || !toSocketId || !sdp) return;
      socket.to(toSocketId).emit("webrtc-answer", {
        roomId,
        fromSocketId: socket.id,
        fromUserId,
        sdp,
      });
    });

    socket.on("webrtc-ice-candidate", ({ roomId, toSocketId, fromUserId, candidate }) => {
      if (!roomId || !toSocketId || !candidate) return;
      socket.to(toSocketId).emit("webrtc-ice-candidate", {
        roomId,
        fromSocketId: socket.id,
        fromUserId,
        candidate,
      });
    });

    socket.on("chat-message", ({ roomId, message, userName, userId, timestamp }) => {
      io.to(roomId).emit("chat-message", {
        id: Date.now().toString(),
        message,
        userName,
        userId,
        timestamp,
      });
    });

    socket.on("send-reaction", ({ roomId, emoji, userName }) => {
      io.to(roomId).emit("reaction-received", { emoji, userName, id: Date.now() });
    });

    socket.on("toggle-mic", ({ roomId, userId, muted }) => {
      socket.to(roomId).emit("participant-update", { userId, muted });
      if (rooms[roomId]) {
        const p = rooms[roomId].participants.find((x) => x.userId === userId);
        if (p) p.muted = muted;
      }
    });

    socket.on("toggle-cam", ({ roomId, userId, camOff }) => {
      socket.to(roomId).emit("participant-update", { userId, camOff });
      if (rooms[roomId]) {
        const p = rooms[roomId].participants.find((x) => x.userId === userId);
        if (p) p.camOff = camOff;
      }
    });

    socket.on("leave-room", ({ roomId, userId, userName }) => {
      cleanupParticipant(socket, io, roomId, userId, userName);
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        const idx = rooms[roomId].participants.findIndex((p) => p.socketId === socket.id);
        if (idx !== -1) {
          const [left] = rooms[roomId].participants.splice(idx, 1);
          io.to(roomId).emit("user-left", { userId: left.userId, userName: left.userName });
          if (rooms[roomId].participants.length === 0) delete rooms[roomId];
          break;
        }
      }
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });
}

function cleanupParticipant(socket, io, roomId, userId, userName) {
  socket.leave(roomId);
  if (rooms[roomId]) {
    rooms[roomId].participants = rooms[roomId].participants.filter((p) => p.socketId !== socket.id);
    io.to(roomId).emit("user-left", { userId, userName });
    if (rooms[roomId].participants.length === 0) delete rooms[roomId];
  }
}

module.exports = socketHandler;
