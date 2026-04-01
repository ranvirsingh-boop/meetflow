const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

let meetings = [];
let scheduledMeetings = [];

// Create instant meeting
router.post("/create", (req, res) => {
  const { hostName } = req.body;
  const meeting = {
    id: uuidv4().slice(0, 9).replace(/-/g, "").toUpperCase(),
    hostName: hostName || "Host",
    createdAt: new Date().toISOString(),
    participants: [],
  };
  meetings.push(meeting);
  res.json({ meeting });
});

// Schedule a meeting
router.post("/schedule", (req, res) => {
  const { title, date, time, duration, description } = req.body;
  if (!title || !date || !time) {
    return res.status(400).json({ error: "title, date and time are required" });
  }
  const meeting = {
    id: uuidv4(),
    title,
    date,
    time,
    duration: duration || "30 minutes",
    description: description || "",
    createdAt: new Date().toISOString(),
  };
  scheduledMeetings.push(meeting);
  res.json({ meeting });
});

// Get all scheduled meetings
router.get("/scheduled", (req, res) => {
  res.json({ meetings: scheduledMeetings });
});

// Delete a scheduled meeting
router.delete("/scheduled/:id", (req, res) => {
  scheduledMeetings = scheduledMeetings.filter((m) => m.id !== req.params.id);
  res.json({ success: true });
});

// Check meeting by ID
router.get("/:id", (req, res) => {
  const meeting = meetings.find((m) => m.id === req.params.id);
  res.json({ exists: true, meeting: meeting || null, id: req.params.id });
});

module.exports = router;
