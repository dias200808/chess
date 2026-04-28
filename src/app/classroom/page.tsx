"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field, LinkButton, SelectField } from "@/components/ui";
import {
  averageAccuracyForStudent,
  basicRecordForStudent,
  buildAIStudentReport,
  buildClassLeaderboard,
  buildStudentPuzzleStats,
  buildTeacherDashboard,
  classCodeFromName,
  pendingCommentsForStudent,
  roleLabel,
} from "@/lib/education";
import {
  getAssignmentProgress,
  getAssignments,
  getClassroomInvitations,
  getClassroomJoinRequests,
  getClassroomMemberships,
  getClassroomNotifications,
  getClassrooms,
  getLessonProgress,
  getPuzzleState,
  getSavedGames,
  getStudentActivities,
  getTeacherComments,
  logStudentActivity,
  saveAssignmentProgress,
  saveAssignments,
  saveClassroomInvitations,
  saveClassroomJoinRequests,
  saveClassroomMemberships,
  saveClassroomNotifications,
  saveClassrooms,
  saveTeacherComments,
} from "@/lib/storage";
import { learnLessons } from "@/lib/learn-content";
import type {
  Assignment,
  AssignmentProgress,
  AssignmentStatus,
  Classroom,
  ClassroomInvitation,
  ClassroomJoinRequest,
  ClassroomMembership,
  ClassroomNotification,
  ClassLevel,
  StudentActivity,
  TeacherComment,
} from "@/lib/types";
import { formatDate, percentage } from "@/lib/utils";

const FREE_TEACHER_CLASS_LIMIT = 1;
const FREE_TEACHER_STUDENT_LIMIT = 5;
const FREE_TEACHER_ASSIGNMENT_LIMIT = 5;

function SectionTitle({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-0">
      <Badge className="max-w-full truncate">{badge}</Badge>
      <h1 className="mt-2 max-w-full break-words text-3xl font-black leading-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="rounded-2xl p-3 sm:p-5">
      <p className="truncate text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-1 break-words font-mono text-2xl font-black leading-none sm:mt-2 sm:text-4xl">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function studentGamesFor(games: ReturnType<typeof getSavedGames>, studentId: string) {
  return games
    .filter((game) => game.whiteUserId === studentId || game.blackUserId === studentId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function lastActiveAt(activities: StudentActivity[], studentId: string, games: ReturnType<typeof getSavedGames>) {
  const activityDate = activities.find((item) => item.userId === studentId)?.createdAt;
  const gameDate = studentGamesFor(games, studentId)[0]?.createdAt;
  return [activityDate, gameDate].filter(Boolean).sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] ?? null;
}

function analysisStatusForGame(game: ReturnType<typeof getSavedGames>[number]) {
  return game.analysis?.evaluations?.some((item) => item.engine === "stockfish") ? "Stockfish" : "Quick";
}

function countMoveTypes(
  game: ReturnType<typeof getSavedGames>[number],
  ...types: Array<ReturnType<typeof getSavedGames>[number]["analysis"]["evaluations"][number]["type"]>
) {
  return game.analysis?.evaluations?.filter((item) => types.includes(item.type)).length ?? 0;
}

export default function ClassroomPage() {
  const { user, profiles } = useAuth();
  const [classes, setClasses] = useState<Classroom[]>(() => getClassrooms());
  const [memberships, setMemberships] = useState<ClassroomMembership[]>(() => getClassroomMemberships());
  const [requests, setRequests] = useState<ClassroomJoinRequest[]>(() => getClassroomJoinRequests());
  const [invitations, setInvitations] = useState<ClassroomInvitation[]>(() => getClassroomInvitations());
  const [assignments, setAssignments] = useState<Assignment[]>(() => getAssignments());
  const [assignmentProgress, setAssignmentProgress] = useState<AssignmentProgress[]>(() => getAssignmentProgress());
  const [comments, setComments] = useState<TeacherComment[]>(() => getTeacherComments());
  const [notifications, setNotifications] = useState<ClassroomNotification[]>(() => getClassroomNotifications());
  const [activities, setActivities] = useState<StudentActivity[]>(() => getStudentActivities());
  const [teacherSearch, setTeacherSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [teacherClassForm, setTeacherClassForm] = useState({
    name: "",
    description: "",
    level: "mixed" as ClassLevel,
  });
  const [inviteForm, setInviteForm] = useState({
    classId: "",
    studentQuery: "",
    message: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    classId: "",
    targetStudentId: "",
    lessonId: "",
    title: "",
    description: "",
    type: "puzzles" as Assignment["type"],
    targetCount: "10",
    dueDate: "",
  });
  const [commentText, setCommentText] = useState("");
  const games = useMemo(() => getSavedGames(), []);

  if (!user) {
    return (
      <Card className="mx-auto max-w-2xl">
        <SectionTitle
          badge="Classroom"
          title="Teacher + Students Chess Platform"
          description="Sign in to create classes, invite students, request to join teachers, and track chess training."
        />
        <div className="mt-5 flex gap-3">
          <LinkButton href="/register">Create account</LinkButton>
          <LinkButton href="/login" variant="secondary">
            Sign in
          </LinkButton>
        </div>
      </Card>
    );
  }

  const currentUser = user;
  const role = currentUser.role ?? "student";
  const isProTeacher = false;

  function persistClassrooms(next: Classroom[]) {
    setClasses(next);
    saveClassrooms(next);
  }

  function persistMemberships(next: ClassroomMembership[]) {
    setMemberships(next);
    saveClassroomMemberships(next);
  }

  function persistRequests(next: ClassroomJoinRequest[]) {
    setRequests(next);
    saveClassroomJoinRequests(next);
  }

  function persistInvitations(next: ClassroomInvitation[]) {
    setInvitations(next);
    saveClassroomInvitations(next);
  }

  function persistAssignments(next: Assignment[]) {
    setAssignments(next);
    saveAssignments(next);
  }

  function persistAssignmentProgress(next: AssignmentProgress[]) {
    setAssignmentProgress(next);
    saveAssignmentProgress(next);
  }

  function persistComments(next: TeacherComment[]) {
    setComments(next);
    saveTeacherComments(next);
  }

  function pushNotification(notification: Omit<ClassroomNotification, "id" | "createdAt" | "read">) {
    const next = [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
      },
      ...notifications,
    ];
    setNotifications(next);
    saveClassroomNotifications(next);
  }

  function pushActivity(activity: Omit<StudentActivity, "id" | "createdAt">) {
    const created = logStudentActivity(activity);
    setActivities((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    return created;
  }

  function teacherClassesForUser() {
    return classes.filter((item) => item.teacherId === currentUser.id);
  }

  function studentClassesForUser(studentId: string) {
    const activeClassIds = memberships
      .filter((item) => item.studentId === studentId && item.status === "active")
      .map((item) => item.classId);
    return classes.filter((item) => activeClassIds.includes(item.id));
  }

  function studentsForClass(classId: string) {
    const ids = memberships
      .filter((item) => item.classId === classId && item.status === "active")
      .map((item) => item.studentId);
    return profiles.filter((profile) => ids.includes(profile.id));
  }

  function totalActiveStudentsForTeacher() {
    const classIds = new Set(teacherClassesForUser().map((item) => item.id));
    return new Set(
      memberships
        .filter((item) => classIds.has(item.classId) && item.status === "active")
        .map((item) => item.studentId),
    ).size;
  }

  function monthlyAssignmentCount() {
    const monthKey = new Date().toISOString().slice(0, 7);
    return assignments.filter(
      (item) => item.teacherId === currentUser.id && item.createdAt.slice(0, 7) === monthKey,
    ).length;
  }

  function requireTeacherLimit(type: "classes" | "students" | "assignments") {
    if (isProTeacher) return false;
    if (type === "classes" && teacherClassesForUser().length >= FREE_TEACHER_CLASS_LIMIT) {
      setUpgradeMessage("Free Teacher allows 1 class. Upgrade to Pro to create more classes.");
      return true;
    }
    if (type === "students" && totalActiveStudentsForTeacher() >= FREE_TEACHER_STUDENT_LIMIT) {
      setUpgradeMessage("Free Teacher allows up to 5 students. Upgrade to Pro to add more students.");
      return true;
    }
    if (type === "assignments" && monthlyAssignmentCount() >= FREE_TEACHER_ASSIGNMENT_LIMIT) {
      setUpgradeMessage("Free Teacher allows 5 assignments per month. Upgrade to Pro for unlimited assignments.");
      return true;
    }
    return false;
  }

  const teacherDashboard =
    role === "teacher"
      ? buildTeacherDashboard({
          teacher: currentUser,
          profiles,
          classes,
          memberships,
          requests,
          assignments,
          assignmentProgress,
          invitations,
          games,
          notifications,
          activities,
        })
      : null;

  const teacherClasses = role === "teacher" ? teacherClassesForUser() : [];
  const selectedClass =
    role === "teacher"
      ? teacherClasses.find((item) => item.id === selectedClassId) ?? teacherClasses[0] ?? null
      : null;
  const selectedClassStudents = selectedClass ? studentsForClass(selectedClass.id) : [];
  const selectedStudent =
    role === "teacher"
      ? selectedClassStudents.find((student) => student.id === selectedStudentId) ??
        selectedClassStudents[0] ??
        null
      : null;

  const selectedStudentGames = selectedStudent ? studentGamesFor(games, selectedStudent.id) : [];
  const selectedStudentPuzzleState = selectedStudent ? getPuzzleState(selectedStudent.id) : {};
  const selectedStudentPuzzleStats = buildStudentPuzzleStats(selectedStudentPuzzleState);
  const selectedStudentActivities = selectedStudent
    ? activities.filter((item) => item.userId === selectedStudent.id).slice(0, 12)
    : [];
  const selectedStudentLessonProgress = selectedStudent ? getLessonProgress(selectedStudent.id) : {};
  const selectedStudentLessons = selectedStudent
    ? learnLessons
        .map((lesson) => ({
          lesson,
          progress: normalizeLessonProgress(selectedStudentLessonProgress[lesson.id]),
        }))
        .filter((item) => item.progress.started || item.progress.completed)
    : [];
  const selectedStudentPuzzles = selectedStudentActivities.filter(
    (item) => item.type === "solved_puzzle" || item.type === "failed_puzzle",
  );
  const selectedStudentAssignments = selectedStudent
    ? assignmentProgress
        .filter((item) => item.studentId === selectedStudent.id)
        .map((progress) => ({
          progress,
          assignment: assignments.find((item) => item.id === progress.assignmentId),
        }))
        .filter((item) => item.assignment)
    : [];
  const selectedStudentReport = selectedStudent
    ? buildAIStudentReport({
        student: selectedStudent,
        games,
        puzzleProgress: selectedStudentPuzzleState,
      })
    : null;
  const selectedStudentRecord = selectedStudent
    ? basicRecordForStudent(games, selectedStudent.id)
    : { wins: 0, losses: 0, draws: 0 };
  const selectedStudentAccuracy = selectedStudent
    ? averageAccuracyForStudent(games, selectedStudent.id)
    : 0;
  const selectedStudentWinRate = percentage(
    selectedStudentRecord.wins,
    selectedStudentRecord.wins + selectedStudentRecord.losses + selectedStudentRecord.draws,
  );

  function normalizeLessonProgress(progress?: Partial<import("@/lib/types").LessonProgress>) {
    return {
      started: false,
      completed: false,
      attempts: 0,
      quizPassed: false,
      timeSpentMs: 0,
      ...progress,
    };
  }

  const visibleTeachers = profiles.filter((profile) => (profile.role ?? "student") === "teacher");
  const searchableClasses = classes.filter((item) => {
    const teacher = profiles.find((profile) => profile.id === item.teacherId);
    const haystack = [
      item.name,
      item.code,
      item.description,
      teacher?.username,
      teacher?.fullName,
      teacher?.schoolName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(teacherSearch.trim().toLowerCase());
  });

  function createClass() {
    if (!teacherClassForm.name.trim()) return;
    if (requireTeacherLimit("classes")) return;
    const created: Classroom = {
      id: crypto.randomUUID(),
      teacherId: currentUser.id,
      name: teacherClassForm.name.trim(),
      code: classCodeFromName(teacherClassForm.name),
      description: teacherClassForm.description.trim(),
      level: teacherClassForm.level,
      createdAt: new Date().toISOString(),
    };
    persistClassrooms([created, ...classes]);
    setSelectedClassId(created.id);
    setTeacherClassForm({ name: "", description: "", level: "mixed" });
  }

  function requestJoinClass(classItem: Classroom) {
    const existing = requests.find(
      (item) => item.classId === classItem.id && item.studentId === currentUser.id && item.status === "pending",
    );
    const alreadyMember = memberships.some(
      (item) => item.classId === classItem.id && item.studentId === currentUser.id && item.status === "active",
    );
    if (existing || alreadyMember) return;

    const nextRequest: ClassroomJoinRequest = {
      id: crypto.randomUUID(),
      classId: classItem.id,
      teacherId: classItem.teacherId,
      studentId: currentUser.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    persistRequests([nextRequest, ...requests]);
    pushNotification({
      userId: classItem.teacherId,
      type: "join_request",
      title: "New class join request",
      body: `${currentUser.fullName || currentUser.username} wants to join ${classItem.name}.`,
      relatedId: nextRequest.id,
    });
  }

  function joinClassByCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const classItem = classes.find((item) => item.code.toUpperCase() === code);
    if (!classItem) {
      setUpgradeMessage("Class code not found. Ask your teacher to send the correct code.");
      return;
    }
    requestJoinClass(classItem);
    setJoinCode("");
  }

  function respondToJoinRequest(requestId: string, accept: boolean) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;
    if (accept && requireTeacherLimit("students")) return;

    persistRequests(
      requests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: accept ? "active" : "rejected",
              respondedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    if (accept) {
      const membership: ClassroomMembership = {
        id: crypto.randomUUID(),
        classId: request.classId,
        teacherId: request.teacherId,
        studentId: request.studentId,
        status: "active",
        requestedAt: request.createdAt,
        respondedAt: new Date().toISOString(),
      };
      persistMemberships([
        membership,
        ...memberships.filter(
          (item) => !(item.classId === request.classId && item.studentId === request.studentId),
        ),
      ]);
    }

    pushNotification({
      userId: request.studentId,
      type: "join_request",
      title: accept ? "Class request accepted" : "Class request rejected",
      body: accept ? "You joined the class successfully." : "Your join request was declined.",
      relatedId: request.classId,
    });
  }

  function sendInvitation() {
    const classItem = classes.find((item) => item.id === inviteForm.classId && item.teacherId === currentUser.id);
    if (!classItem || !inviteForm.studentQuery.trim()) return;
    if (requireTeacherLimit("students")) return;

    const query = inviteForm.studentQuery.trim().toLowerCase();
    const student = profiles.find(
      (profile) =>
        (profile.role ?? "student") === "student" &&
        (profile.username.toLowerCase() === query || profile.email.toLowerCase() === query),
    );
    if (!student) {
      setUpgradeMessage("Student not found. Enter a valid username or email.");
      return;
    }

    const existing = invitations.find(
      (item) => item.classId === classItem.id && item.studentId === student.id && item.status === "invited",
    );
    if (existing) return;

    const invitation: ClassroomInvitation = {
      id: crypto.randomUUID(),
      classId: classItem.id,
      teacherId: currentUser.id,
      studentId: student.id,
      status: "invited",
      message: inviteForm.message.trim(),
      createdAt: new Date().toISOString(),
    };
    persistInvitations([invitation, ...invitations]);
    pushNotification({
      userId: student.id,
      type: "invitation",
      title: "Teacher invitation",
      body: `${currentUser.fullName || currentUser.username} invited you to join ${classItem.name}.`,
      relatedId: invitation.id,
    });
    setInviteForm({ classId: inviteForm.classId, studentQuery: "", message: "" });
  }

  function respondToInvitation(invitationId: string, accept: boolean) {
    const invitation = invitations.find((item) => item.id === invitationId);
    if (!invitation) return;

    persistInvitations(
      invitations.map((item) =>
        item.id === invitationId
          ? {
              ...item,
              status: accept ? "active" : "declined",
              respondedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    if (accept) {
      const membership: ClassroomMembership = {
        id: crypto.randomUUID(),
        classId: invitation.classId,
        teacherId: invitation.teacherId,
        studentId: invitation.studentId,
        status: "active",
        requestedAt: invitation.createdAt,
        respondedAt: new Date().toISOString(),
      };
      persistMemberships([
        membership,
        ...memberships.filter(
          (item) => !(item.classId === invitation.classId && item.studentId === invitation.studentId),
        ),
      ]);
    }
  }

  function removeStudent(studentId: string, classId: string) {
    persistMemberships(
      memberships.filter((item) => !(item.classId === classId && item.studentId === studentId)),
    );
    if (selectedStudentId === studentId) {
      setSelectedStudentId("");
    }
  }

  function createAssignment() {
    const classItem = classes.find(
      (item) => item.id === assignmentForm.classId && item.teacherId === currentUser.id,
    );
    if (!classItem || !assignmentForm.title.trim()) return;
    if (assignmentForm.type === "lessons" && !assignmentForm.lessonId) return;
    if (requireTeacherLimit("assignments")) return;

    const targetStudents = assignmentForm.targetStudentId
      ? memberships.filter(
          (item) =>
            item.classId === classItem.id &&
            item.studentId === assignmentForm.targetStudentId &&
            item.status === "active",
        )
      : memberships.filter((item) => item.classId === classItem.id && item.status === "active");

    const assignment: Assignment = {
      id: crypto.randomUUID(),
      classId: classItem.id,
      teacherId: currentUser.id,
      studentId: assignmentForm.targetStudentId || undefined,
      lessonId: assignmentForm.type === "lessons" ? assignmentForm.lessonId || undefined : undefined,
      title: assignmentForm.title.trim(),
      description: assignmentForm.description.trim(),
      type: assignmentForm.type,
      createdAt: new Date().toISOString(),
      dueDate: assignmentForm.dueDate || undefined,
      targetCount: Number(assignmentForm.targetCount) || undefined,
    };

    const nextProgress = [
      ...targetStudents.map((membership) => ({
        id: crypto.randomUUID(),
        assignmentId: assignment.id,
        studentId: membership.studentId,
        status: "open" as AssignmentStatus,
        completionPercent: 0,
        completedCount: 0,
        updatedAt: new Date().toISOString(),
      })),
      ...assignmentProgress,
    ];

    persistAssignments([assignment, ...assignments]);
    persistAssignmentProgress(nextProgress);

    targetStudents.forEach((membership) => {
      pushNotification({
        userId: membership.studentId,
        type: "assignment",
        title: "New assignment",
        body: `${assignment.title} was assigned in ${classItem.name}.`,
        relatedId: assignment.id,
      });
    });

    setAssignmentForm({
      classId: assignmentForm.classId,
      targetStudentId: "",
      lessonId: "",
      title: "",
      description: "",
      type: "puzzles",
      targetCount: "10",
      dueDate: "",
    });
  }

  function completeAssignment(progressId: string) {
    const next = assignmentProgress.map((item) =>
      item.id === progressId
        ? {
            ...item,
            status: "completed" as AssignmentStatus,
            completionPercent: 100,
            completedCount: 1,
            accuracy: item.accuracy ?? 78,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }
        : item,
    );
    persistAssignmentProgress(next);

    const updated = next.find((item) => item.id === progressId);
    const assignment = assignments.find((item) => item.id === updated?.assignmentId);
    if (!assignment) return;

    pushNotification({
      userId: assignment.teacherId,
      type: "assignment_completed",
      title: "Assignment completed",
      body: `${currentUser.fullName || currentUser.username} completed ${assignment.title}.`,
      relatedId: assignment.id,
    });
    pushActivity({
      userId: currentUser.id,
      type: "completed_assignment",
      title: `Completed assignment: ${assignment.title}`,
      relatedId: assignment.id,
      details: assignment.description || assignment.type,
    });
  }

  function addTeacherComment() {
    if (!selectedStudent || !commentText.trim()) return;
    const comment: TeacherComment = {
      id: crypto.randomUUID(),
      teacherId: currentUser.id,
      studentId: selectedStudent.id,
      targetType: "assignment",
      targetId: selectedStudent.id,
      comment: commentText.trim(),
      createdAt: new Date().toISOString(),
    };
    persistComments([comment, ...comments]);
    pushNotification({
      userId: selectedStudent.id,
      type: "teacher_comment",
      title: "Teacher feedback",
      body: comment.comment,
      relatedId: comment.id,
    });
    setCommentText("");
  }

  if (role === "teacher" && teacherDashboard) {
    const leaderboard = buildClassLeaderboard({
      students: selectedClassStudents,
      games,
      puzzleProgressByStudent: Object.fromEntries(
        selectedClassStudents.map((student) => [student.id, getPuzzleState(student.id)]),
      ),
      assignmentProgress,
    });
    const teacherRequests = requests.filter(
      (item) => item.teacherId === currentUser.id && item.status === "pending",
    );
    const selectedClassAssignments = selectedClass
      ? assignments.filter((item) => item.classId === selectedClass.id)
      : [];
    const freePlanSummary = `${teacherClasses.length}/${FREE_TEACHER_CLASS_LIMIT} classes • ${totalActiveStudentsForTeacher()}/${FREE_TEACHER_STUDENT_LIMIT} students • ${monthlyAssignmentCount()}/${FREE_TEACHER_ASSIGNMENT_LIMIT} assignments`;

    return (
      <div className="grid min-w-0 gap-5 sm:gap-6">
        {upgradeMessage ? (
          <Card className="border-primary/40 bg-primary/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black">Upgrade to Pro</p>
                <p className="mt-1 text-sm text-muted-foreground">{upgradeMessage}</p>
              </div>
              <div className="flex gap-2">
                <LinkButton href="/pricing">See Pro</LinkButton>
                <Button variant="secondary" onClick={() => setUpgradeMessage("")}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <SectionTitle
          badge="Teacher Dashboard"
          title={currentUser.fullName ? `${currentUser.fullName}'s Classroom` : "Teacher Dashboard"}
          description="Create classes, invite students, review activity, and track assignments from one place."
        />

        <Card className="rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Free Teacher plan</p>
              <p className="mt-1 font-semibold">{freePlanSummary}</p>
            </div>
            <LinkButton href="/pricing" variant="secondary">
              Upgrade
            </LinkButton>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-7">
          <StatCard label="Students" value={teacherDashboard.totalStudents} />
          <StatCard label="Active today" value={teacherDashboard.activeStudentsToday} />
          <StatCard label="Puzzles today" value={teacherDashboard.puzzlesSolvedToday} />
          <StatCard label="Games today" value={teacherDashboard.gamesToday} />
          <StatCard label="Join requests" value={teacherDashboard.pendingJoinRequests} />
          <StatCard label="Pending tasks" value={teacherDashboard.pendingAssignments} />
          <StatCard label="Low activity" value={teacherDashboard.lowActivityStudents.length} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-2xl font-black">Create Class</h2>
            <div className="mt-4 grid gap-4">
              <Field
                label="Class name"
                value={teacherClassForm.name}
                onChange={(event) => setTeacherClassForm({ ...teacherClassForm, name: event.target.value })}
              />
              <Field
                label="Description"
                value={teacherClassForm.description}
                onChange={(event) =>
                  setTeacherClassForm({ ...teacherClassForm, description: event.target.value })
                }
              />
              <SelectField
                label="Level"
                value={teacherClassForm.level}
                onChange={(event) =>
                  setTeacherClassForm({ ...teacherClassForm, level: event.target.value as ClassLevel })
                }
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="mixed">Mixed</option>
              </SelectField>
              <Button onClick={createClass}>Create class</Button>
            </div>

            <div className="mt-5 grid gap-3">
              {teacherClasses.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedClassId(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedClass?.id === item.id ? "border-primary bg-primary/10" : "bg-muted"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description || "No description yet."}
                      </p>
                    </div>
                    <Badge>{item.code}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Pending Requests</h2>
            <div className="mt-4 grid gap-3">
              {teacherRequests.map((item) => {
                const student = profiles.find((profile) => profile.id === item.studentId);
                const classItem = classes.find((entry) => entry.id === item.classId);
                return (
                  <div key={item.id} className="rounded-2xl bg-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {student?.fullName || student?.username || "Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{student?.username || "student"} • {classItem?.name || "Class"} • {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <Badge>{classItem?.code || "Code"}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => respondToJoinRequest(item.id, true)}>Accept</Button>
                      <Button variant="secondary" onClick={() => respondToJoinRequest(item.id, false)}>
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!teacherRequests.length ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : null}
            </div>
          </Card>
        </div>

        {selectedClass ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">{selectedClass.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Code {selectedClass.code} • {selectedClassStudents.length} students • {selectedClass.level}
                </p>
              </div>
              <Badge>{selectedClass.description || "Class page"}</Badge>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <h2 className="text-2xl font-black">Invite Student</h2>
            <div className="mt-4 grid gap-4">
              <SelectField
                label="Class"
                value={inviteForm.classId}
                onChange={(event) => setInviteForm({ ...inviteForm, classId: event.target.value })}
              >
                <option value="">Select class</option>
                {teacherClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Student username or email"
                value={inviteForm.studentQuery}
                onChange={(event) => setInviteForm({ ...inviteForm, studentQuery: event.target.value })}
              />
              <Field
                label="Message"
                value={inviteForm.message}
                onChange={(event) => setInviteForm({ ...inviteForm, message: event.target.value })}
              />
              <Button onClick={sendInvitation}>Send invitation</Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Assignments</h2>
            <div className="mt-4 grid gap-4">
              <SelectField
                label="Class"
                value={assignmentForm.classId}
                onChange={(event) =>
                  setAssignmentForm({ ...assignmentForm, classId: event.target.value, targetStudentId: "" })
                }
              >
                <option value="">Select class</option>
                {teacherClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Target"
                value={assignmentForm.targetStudentId}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, targetStudentId: event.target.value })}
              >
                <option value="">Entire class</option>
                {studentsForClass(assignmentForm.classId || selectedClass?.id || "").map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName || student.username}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Title"
                value={assignmentForm.title}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, title: event.target.value })}
              />
              <Field
                label="Description"
                value={assignmentForm.description}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, description: event.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Type"
                  value={assignmentForm.type}
                onChange={(event) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    type: event.target.value as Assignment["type"],
                    lessonId: event.target.value === "lessons" ? assignmentForm.lessonId : "",
                  })
                }
              >
                  <option value="puzzles">Solve puzzles</option>
                  <option value="games">Play games</option>
                  <option value="lessons">Complete lesson</option>
                  <option value="review">Review mistakes</option>
                  <option value="opening">Opening practice</option>
                </SelectField>
                {assignmentForm.type === "lessons" ? (
                  <SelectField
                    label="Lesson"
                    value={assignmentForm.lessonId}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, lessonId: event.target.value })}
                  >
                    <option value="">Select lesson</option>
                    {learnLessons.map((lessonItem) => (
                      <option key={lessonItem.id} value={lessonItem.id}>
                        {lessonItem.title}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
                <Field
                  label="Target amount"
                  type="number"
                  value={assignmentForm.targetCount}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, targetCount: event.target.value })}
                />
                <Field
                  label="Due date"
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })}
                />
              </div>
              <Button onClick={createAssignment}>Create assignment</Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <h2 className="text-2xl font-black">Student List</h2>
            <div className="mt-4 grid gap-3">
              {selectedClassStudents.map((student) => {
                const studentGames = studentGamesFor(games, student.id);
                const puzzleStats = buildStudentPuzzleStats(getPuzzleState(student.id));
                const accuracy = averageAccuracyForStudent(games, student.id);
                const activeAt = lastActiveAt(activities, student.id, games);
                const activeClassId = selectedClass?.id ?? "";
                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl border p-4 ${selectedStudent?.id === student.id ? "border-primary bg-primary/10" : "bg-muted"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className="text-left"
                      >
                        <p className="font-semibold">{student.fullName || student.username}</p>
                        <p className="text-xs text-muted-foreground">
                          @{student.username} • {student.rating} rating • {student.puzzleRating} puzzle
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Games {studentGames.length} • Puzzles solved {puzzleStats.solved} • Accuracy {accuracy}% • Last active{" "}
                          {activeAt ? formatDate(activeAt) : "No activity yet"}
                        </p>
                      </button>
                      <Button variant="secondary" onClick={() => removeStudent(student.id, activeClassId)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!selectedClassStudents.length ? (
                <p className="text-sm text-muted-foreground">Students will appear here after requests are accepted.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Class Leaderboard</h2>
            <div className="mt-4 grid gap-3">
              {leaderboard.map((entry, index) => {
                const gamesPlayed = studentGamesFor(games, entry.student.id).length;
                return (
                  <div
                    key={entry.student.id}
                    className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-muted p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:p-4"
                  >
                    <div className="text-center font-mono text-2xl font-black">{index + 1}</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{entry.student.fullName || entry.student.username}</p>
                      <p className="break-words text-xs text-muted-foreground">
                        Rating {entry.student.rating} • Puzzle {entry.student.puzzleRating} • Solved {entry.solvedPuzzles} • Games {gamesPlayed}
                      </p>
                    </div>
                    <Badge>{entry.activityScore}</Badge>
                  </div>
                );
              })}
              {!leaderboard.length ? (
                <p className="text-sm text-muted-foreground">The leaderboard will appear after students start training.</p>
              ) : null}
            </div>
          </Card>
        </div>

        {selectedStudent && selectedStudentReport ? (
          <div className="grid gap-6">
            <SectionTitle
              badge="Student Profile"
              title={selectedStudent.fullName || selectedStudent.username}
              description="Teacher view of games, puzzles, assignments, activity, and basic AI report."
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-8">
              <StatCard label="Rating" value={selectedStudent.rating} />
              <StatCard label="Puzzle rating" value={selectedStudent.puzzleRating} />
              <StatCard label="Games" value={selectedStudentGames.length} />
              <StatCard label="Win rate" value={`${selectedStudentWinRate}%`} />
              <StatCard label="Wins" value={selectedStudentRecord.wins} />
              <StatCard label="Losses" value={selectedStudentRecord.losses} />
              <StatCard label="Draws" value={selectedStudentRecord.draws} />
              <StatCard label="Average accuracy" value={`${selectedStudentAccuracy}%`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card>
                <h2 className="text-2xl font-black">AI Student Report</h2>
                <div className="mt-4 rounded-2xl bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Main weakness: {selectedStudentReport.mainIssue}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Frequent issue: {selectedStudentReport.commonMistake}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recommended training: {selectedStudentReport.recommendation}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Activity summary: {selectedStudentGames.length} games, {selectedStudentPuzzleStats.solved} solved puzzles
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStudentReport.weakestThemes.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Assignments Progress</h2>
                <div className="mt-4 grid gap-3">
                  {selectedStudentAssignments.map(({ assignment, progress }) => (
                    <div key={progress.id} className="rounded-2xl bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">{assignment?.title}</p>
                        <Badge>{progress.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {assignment?.type} • {progress.completionPercent}% • Due{" "}
                        {assignment?.dueDate ? formatDate(assignment.dueDate) : "No due date"}
                      </p>
                    </div>
                  ))}
                  {!selectedStudentAssignments.length ? (
                    <p className="text-sm text-muted-foreground">No assignment progress yet.</p>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <h2 className="text-2xl font-black">Recent Games</h2>
                <div className="mt-4 grid gap-3">
                  {selectedStudentGames.slice(0, 8).map((game) => (
                    <div key={game.id} className="rounded-2xl bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {formatDate(game.createdAt)} • {game.opponent}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {game.result} • {game.moves.length} moves • {game.timeControl || "No clock"} • Accuracy{" "}
                            {game.whiteUserId === selectedStudent.id ? game.whiteAccuracy : game.blackAccuracy}%
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Mistakes {countMoveTypes(game, "mistake")} • Blunders {countMoveTypes(game, "blunder")} • Analysis {analysisStatusForGame(game)}
                          </p>
                        </div>
                        <LinkButton href={`/analysis?id=${game.id}&autostart=1`} variant="secondary">
                          Open Analysis
                        </LinkButton>
                      </div>
                    </div>
                  ))}
                  {!selectedStudentGames.length ? (
                    <p className="text-sm text-muted-foreground">No games saved yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Puzzle Tracking</h2>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-muted p-4">
                    <p className="font-semibold">Solved {selectedStudentPuzzleStats.solved}</p>
                    <p className="text-xs text-muted-foreground">
                      Failed {selectedStudentPuzzleStats.failed} • Best streak {selectedStudentPuzzleStats.bestStreak}
                    </p>
                  </div>
                  {selectedStudentPuzzles.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="rounded-2xl bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">{activity.title}</p>
                        <Badge>{activity.type === "solved_puzzle" ? "Solved" : "Failed"}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {activity.details || "Puzzle activity"} • {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  ))}
                  {!selectedStudentPuzzles.length ? (
                    <p className="text-sm text-muted-foreground">Puzzle activity will appear here after training.</p>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card>
                <h2 className="text-2xl font-black">Recent Activity</h2>
                <div className="mt-4 grid gap-3">
                  {selectedStudentActivities.map((activity) => (
                    <div key={activity.id} className="rounded-2xl bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">{activity.title}</p>
                        <Badge>{activity.type}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {activity.details || "Activity"} • {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  ))}
                  {!selectedStudentActivities.length ? (
                    <p className="text-sm text-muted-foreground">No tracked activity yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Teacher Comments</h2>
                <textarea
                  className="mt-4 min-h-28 w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Add feedback for this student..."
                />
                <Button className="mt-3" onClick={addTeacherComment}>
                  Save comment
                </Button>
                <div className="mt-4 grid gap-3">
                  {pendingCommentsForStudent(comments, selectedStudent.id)
                    .slice(0, 5)
                    .map((item) => (
                      <div key={item.id} className="rounded-xl bg-muted p-3 text-sm">
                        <p>{item.comment}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Card>
              <h2 className="text-2xl font-black">Lesson Progress</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedStudentLessons.slice(0, 10).map(({ lesson, progress }) => (
                  <div key={lesson.id} className="rounded-2xl bg-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{lesson.title}</p>
                      <Badge>{progress.completed ? "Completed" : "Started"}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lesson.courseId} • Attempts {progress.attempts} • Quiz {progress.quizPassed ? "passed" : "pending"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {progress.completedAt ? `Completed ${formatDate(progress.completedAt)}` : progress.startedAt ? `Started ${formatDate(progress.startedAt)}` : "No timestamp"}
                    </p>
                  </div>
                ))}
                {!selectedStudentLessons.length ? (
                  <p className="text-sm text-muted-foreground">No lesson progress yet.</p>
                ) : null}
              </div>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <h2 className="text-2xl font-black">Recent Student Activity</h2>
            <div className="mt-4 grid gap-3">
              {teacherDashboard.recentActivity.map((activity) => {
                const student = profiles.find((profile) => profile.id === activity.userId);
                return (
                  <div key={activity.id} className="rounded-2xl bg-muted p-4">
                    <p className="font-semibold">{student?.fullName || student?.username || "Student"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{activity.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                  </div>
                );
              })}
              {!teacherDashboard.recentActivity.length ? (
                <p className="text-sm text-muted-foreground">No recent activity yet.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Students with Low Activity</h2>
            <div className="mt-4 grid gap-3">
              {teacherDashboard.lowActivityStudents.map((student) => (
                <div key={student.id} className="rounded-2xl bg-muted p-4">
                  <p className="font-semibold">{student.fullName || student.username}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last active {lastActiveAt(activities, student.id, games) ? formatDate(lastActiveAt(activities, student.id, games) as string) : "No activity yet"}
                  </p>
                </div>
              ))}
              {!teacherDashboard.lowActivityStudents.length ? (
                <p className="text-sm text-muted-foreground">Everyone has recent activity.</p>
              ) : null}
            </div>
          </Card>
        </div>

        {selectedClassAssignments.length ? (
          <Card>
            <h2 className="text-2xl font-black">Class Assignments</h2>
            <div className="mt-4 grid gap-3">
              {selectedClassAssignments.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl bg-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description || item.type}
                        {item.lessonId
                          ? ` • Lesson ${learnLessons.find((lesson) => lesson.id === item.lessonId)?.title || item.lessonId}`
                          : ""}
                        {" • "}Due {item.dueDate ? formatDate(item.dueDate) : "No due date"}
                      </p>
                    </div>
                    <Badge>{item.studentId ? "Student" : "Class"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  const studentClasses = studentClassesForUser(currentUser.id);
  const studentInvitations = invitations.filter(
    (item) => item.studentId === currentUser.id && item.status === "invited",
  );
  const studentAssignments = assignmentProgress
    .filter((item) => item.studentId === currentUser.id)
    .map((progress) => ({
      progress,
      assignment: assignments.find((item) => item.id === progress.assignmentId),
    }))
    .filter((item) => item.assignment);
  const studentComments = pendingCommentsForStudent(comments, currentUser.id);
  const ownReport = buildAIStudentReport({
    student: currentUser,
    games,
    puzzleProgress: getPuzzleState(currentUser.id),
  });
  const studentNotifications = notifications.filter((item) => item.userId === currentUser.id).slice(0, 6);

  return (
    <div className="grid min-w-0 gap-5 sm:gap-6">
      {upgradeMessage ? (
        <Card className="border-primary/40 bg-primary/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{upgradeMessage}</p>
            <Button variant="secondary" onClick={() => setUpgradeMessage("")}>
              Close
            </Button>
          </div>
        </Card>
      ) : null}

      <SectionTitle
        badge="Student Dashboard"
        title={currentUser.fullName ? `Welcome, ${currentUser.fullName}` : "Student Dashboard"}
        description="Join a teacher class, complete assignments, and let your teacher track games and puzzles."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        <StatCard label="Role" value={roleLabel(currentUser.role)} />
        <StatCard label="Rating" value={currentUser.rating} />
        <StatCard label="Puzzle rating" value={currentUser.puzzleRating} />
        <StatCard label="My classes" value={studentClasses.length} />
        <StatCard
          label="Open assignments"
          value={studentAssignments.filter((item) => item.progress.status !== "completed").length}
        />
        <StatCard label="Teacher feedback" value={studentComments.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-2xl font-black">Join Class</h2>
          <div className="mt-4 grid gap-4">
            <Field
              label="Class code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="A7K92"
            />
            <Button onClick={joinClassByCode}>Send request by class code</Button>
            <Field
              label="Find teacher by name, code, or school"
              value={teacherSearch}
              onChange={(event) => setTeacherSearch(event.target.value)}
            />
            <div className="grid gap-3">
              {(teacherSearch.trim() ? searchableClasses : classes.slice(0, 6)).map((item) => {
                const teacher = visibleTeachers.find((profile) => profile.id === item.teacherId);
                const pending = requests.some(
                  (request) =>
                    request.classId === item.id &&
                    request.studentId === currentUser.id &&
                    request.status === "pending",
                );
                const joined = memberships.some(
                  (membership) =>
                    membership.classId === item.id &&
                    membership.studentId === currentUser.id &&
                    membership.status === "active",
                );
                return (
                  <div key={item.id} className="rounded-2xl bg-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {teacher?.fullName || teacher?.username || "Teacher"} / {teacher?.schoolName || item.level}
                        </p>
                      </div>
                      <Badge>{item.code}</Badge>
                    </div>
                    <Button className="mt-3" disabled={pending || joined} onClick={() => requestJoinClass(item)}>
                      {joined ? "Joined" : pending ? "Request sent" : "Request to join"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Teacher Invitations</h2>
          <div className="mt-4 grid gap-3">
            {studentInvitations.map((item) => {
              const classItem = classes.find((entry) => entry.id === item.classId);
              const teacher = profiles.find((profile) => profile.id === item.teacherId);
              return (
                <div key={item.id} className="rounded-2xl bg-muted p-4">
                  <p className="font-semibold">{classItem?.name || "Class invitation"}</p>
                  <p className="text-sm text-muted-foreground">
                    {teacher?.fullName || teacher?.username} invited you to join.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => respondToInvitation(item.id, true)}>Accept</Button>
                    <Button variant="secondary" onClick={() => respondToInvitation(item.id, false)}>
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
            {!studentInvitations.length ? (
              <p className="text-sm text-muted-foreground">No invitations right now.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-2xl font-black">My Class</h2>
          <div className="mt-4 grid gap-3">
            {studentClasses.map((item) => {
              const teacher = profiles.find((profile) => profile.id === item.teacherId);
              return (
                <div key={item.id} className="rounded-2xl bg-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Teacher: {teacher?.fullName || teacher?.username || "Unknown"} / Code {item.code}
                      </p>
                    </div>
                    <Badge>{item.level}</Badge>
                  </div>
                </div>
              );
            })}
            {!studentClasses.length ? (
              <p className="text-sm text-muted-foreground">Join a teacher class to see it here.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">AI Report</h2>
          <div className="mt-4 rounded-2xl bg-muted p-4">
            <p className="text-sm text-muted-foreground">Main weakness: {ownReport.mainIssue}</p>
            <p className="mt-2 text-sm text-muted-foreground">Frequent mistakes: {ownReport.commonMistake}</p>
            <p className="mt-2 text-sm text-muted-foreground">Recommended training: {ownReport.recommendation}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Activity summary: {studentGamesFor(games, currentUser.id).length} games, {buildStudentPuzzleStats(getPuzzleState(currentUser.id)).solved} solved puzzles
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-2xl font-black">Assignments</h2>
          <div className="mt-4 grid gap-3">
            {studentAssignments.map(({ progress, assignment }) => (
              <div key={progress.id} className="rounded-2xl bg-muted p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{assignment?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment?.description || assignment?.type}
                    </p>
                  </div>
                  <Badge>{progress.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Due: {assignment?.dueDate ? formatDate(assignment.dueDate) : "No due date"} / Progress{" "}
                  {progress.completionPercent}%
                </p>
                {progress.status !== "completed" ? (
                  <Button className="mt-3" onClick={() => completeAssignment(progress.id)}>
                    Mark complete
                  </Button>
                ) : null}
              </div>
            ))}
            {!studentAssignments.length ? <p className="text-sm text-muted-foreground">No assignments yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Teacher Feedback</h2>
          <div className="mt-4 grid gap-3">
            {studentComments.map((item) => (
              <div key={item.id} className="rounded-2xl bg-muted p-4">
                <p className="text-sm">{item.comment}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
            ))}
            {!studentComments.length ? (
              <p className="text-sm text-muted-foreground">Teacher comments will appear here.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-2xl font-black">Notifications</h2>
        <div className="mt-4 grid gap-3">
          {studentNotifications.map((item) => (
            <div key={item.id} className="rounded-2xl bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{item.title}</p>
                <Badge>{item.type}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
            </div>
          ))}
          {!studentNotifications.length ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
