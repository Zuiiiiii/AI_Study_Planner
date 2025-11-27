const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ===============================
// In-memory "database"
// ===============================
let students = {};    // student + parent info
let assignments = {}; // weekly assignments per student
let tasks = {};       // today's tasks per student
let schedules = {};   // time-table per student

// ===============================
// TEST ROUTE
// ===============================
app.get("/", (req, res) => {
  res.send("AI Study Planner backend is running ✅");
});

// ===============================
// MAIN ROUTE – generate schedule
// ===============================
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
    marks: null, // you can fill this later from frontend
  }));

  // today's tasks
  const todayTasks = schedule.map((item, i) => ({
    id: `${studentName}-task-${i + 1}`,
    subject: item.subject,
    duration: item.duration,
    done: false,
  }));

  // ===== save everything in memory so parent dashboard can use it =====
  students[studentName] = {
    parent,
    studyHours,
    studySlot,
    subjects,
  };
  schedules[studentName] = schedule;
  assignments[studentName] = weeklyAssignments;
  tasks[studentName] = todayTasks;

  // return to frontend
  res.json({
    schedule,
    weeklyAssignments,
    todayTasks,
    studySlot,
    timePerSubject,
  });
});

// ===============================
// UPDATE TASKS (mark done / not)
// ===============================
app.post("/api/update-tasks", (req, res) => {
  const { studentName, completedTaskIds } = req.body;

  if (!students[studentName]) {
    return res.status(404).json({ error: "Student not found" });
  }

  const currentTasks = tasks[studentName] || [];
  currentTasks.forEach((t) => {
    t.done = completedTaskIds.includes(t.id);
  });

  const total = currentTasks.length;
  const done = currentTasks.filter((t) => t.done).length;
  const incomplete = total - done;

  res.json({
    total,
    done,
    incomplete,
    tasks: currentTasks,
  });
});

// ===============================
// ALERT PARENT (simulated email)
// ===============================
app.post("/api/alert-parent", (req, res) => {
  const { studentName } = req.body;

  const student = students[studentName];
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const studentTasks = tasks[studentName] || [];
  const incompleteTasks = studentTasks.filter((t) => !t.done);

  const alertPayload = {
    to: student.parent.email,
    parentName: student.parent.name,
    studentName,
    incompleteTasks,
  };

  // In a real app you would send an email here.
  console.log("Simulated email payload:", alertPayload);

  res.json({
    success: true,
    message: "Alert simulated. In real backend, email would be sent.",
    alertPayload,
  });
});
// ===============================
// UPDATE ASSIGNMENT MARKS
// ===============================
app.post("/api/update-marks", (req, res) => {
  const { studentName, marks } = req.body; // marks = [ { index, score } ]

  if (!studentName || !Array.isArray(marks)) {
    return res.status(400).json({ error: "Invalid data" });
  }

  if (!students[studentName]) {
    return res.status(404).json({ error: "Student not found" });
  }

  const assns = assignments[studentName] || [];

  marks.forEach((entry) => {
    const { index, score } = entry;
    if (
      typeof index === "number" &&
      assns[index] &&
      typeof score === "number" &&
      !Number.isNaN(score)
    ) {
      assns[index].marks = score;
    }
  });

  assignments[studentName] = assns;

  res.json({
    success: true,
    assignments: assns,
  });
});

// ===============================
// PARENT OVERVIEW (for dashboard)
// ===============================
app.get("/api/parent-overview", (req, res) => {
  const studentName = req.query.studentName;

  if (!studentName || !students[studentName]) {
    return res
      .status(404)
      .json({ error: "Student not found. Ask your child to generate a plan first." });
  }

  const student = students[studentName];
  const studentSchedule = schedules[studentName] || [];
  const studentAssignments = assignments[studentName] || [];
  const studentTasks = tasks[studentName] || [];

  // tasks summary
  const totalTasks = studentTasks.length;
  const doneTasks = studentTasks.filter((t) => t.done).length;
  const incompleteTasks = totalTasks - doneTasks;
  const completionPercent = totalTasks
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0;

  // planned hours (sum durations)
  let plannedHours = 0;
  studentSchedule.forEach((s) => {
    const num = parseFloat(s.duration);
    if (!isNaN(num)) plannedHours += num;
  });

  const timePerTask = plannedHours && totalTasks ? plannedHours / totalTasks : 0;
  const completedHours = +(doneTasks * timePerTask).toFixed(1);

  // average marks
  let totalMarks = 0;
  let countMarks = 0;
  studentAssignments.forEach((a) => {
    if (typeof a.marks === "number") {
      totalMarks += a.marks;
      countMarks++;
    }
  });
  const avgMarks = countMarks ? Math.round(totalMarks / countMarks) : null;

  // active subject
  let activeSubject = "-";
  const firstIncomplete = studentTasks.find((t) => !t.done);
  if (firstIncomplete) activeSubject = firstIncomplete.subject;
  else if (studentSchedule[0]) activeSubject = studentSchedule[0].subject;

  // alerts this week (for now = incomplete tasks)
  const alertsThisWeek = incompleteTasks;

  res.json({
    studentName,
    parent: student.parent,
    studyHours: student.studyHours,
    schedule: studentSchedule,
    assignments: studentAssignments,
    tasks: studentTasks,
    summary: {
      completionPercent,
      plannedHours: +plannedHours.toFixed(1),
      completedHours,
      alertsThisWeek,
      avgMarks,
      activeSubject,
    },
  });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
