require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const meetingRoutes = require("./routes/meetings");
const socketHandler = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use("/api/meetings", meetingRoutes);

app.get("/", (req, res) => {
  res.json({ message: "MeetFlow backend running 🚀", status: "ok" });
});

socketHandler(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅  MeetFlow backend running on http://localhost:${PORT}`);
});
