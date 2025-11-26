const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// TEST ROUTE – to check if backend works
app.get("/", (req, res) => {
  res.send("AI Study Planner backend is running ✅");
});

// MAIN ROUTE – generate schedule (simple logic, no AI model)
app.post("/api/generate-schedule", (req, res) => {
  const { studentName, studyHours, studySlot, parent, subjects } = req.body;

  if (!studentName || !studyHours || !subjects || subjects.length === 0) {
    return res.status(400).json({ error: "Missing required data" });
  }

  // simple equal distribution logic
  const timePerSubject = +(studyHours / subjects.length).toFixed(1);

  const schedule = subjects.map((subj, index) => ({
    slot: `Slot ${index + 1}`,
    subject: subj.name,
    duration: `${timePerSubject} hr`,
  }));

  // weekly assignments: one per subject
  const weeklyAssignments = subjects.map((subj, index) => ({
    id: `${studentName}-assn-${index + 1}`,
    subject: subj.name,
    syllabus: subj.syllabus || "Syllabus-based exercise",
    dueWeek: index + 1,
    marks: null,
  }));

  // today's tasks
  const todayTasks = schedule.map((item, i) => ({
    id: `${studentName}-task-${i + 1}`,
    subject: item.subject,
    duration: item.duration,
    done: false,
  }));

  res.json({
    schedule,
    weeklyAssignments,
    todayTasks,
    studySlot,
    timePerSubject,
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
