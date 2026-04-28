"use client";

import { useMemo, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  Target,
} from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card } from "@/components/ui";
import { buildAIStudentReport } from "@/lib/education";
import { learnCourses, learnLessons, lessonsForCourse, type LearnLesson } from "@/lib/learn-content";
import {
  getAssignmentProgress,
  getAssignments,
  getLessonProgress,
  getPuzzleState,
  getSavedGames,
  logStudentActivity,
  saveAssignmentProgress,
  setLessonProgress,
} from "@/lib/storage";
import type { LessonProgress } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

function defaultLessonProgress(): LessonProgress {
  return {
    started: false,
    completed: false,
    attempts: 0,
    quizPassed: false,
    timeSpentMs: 0,
  };
}

function normalizeProgress(progress?: Partial<LessonProgress>) {
  return {
    ...defaultLessonProgress(),
    ...progress,
  };
}

function setFenTurn(fen: string, turn: "w" | "b") {
  const parts = fen.split(" ");
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(" ");
}

function replayExampleFen(fen: string, moves: string[], ply: number) {
  let currentFen = fen;

  for (const move of moves.slice(0, ply)) {
    const chess = new Chess(currentFen);
    const from = move.slice(0, 2) as Square;
    const piece = chess.get(from);

    if (!piece) break;

    if (chess.turn() !== piece.color) {
      chess.load(setFenTurn(currentFen, piece.color));
    }

    try {
      chess.move(move);
      currentFen = chess.fen();
    } catch {
      break;
    }
  }

  return currentFen;
}

function moveCode(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function expectedSquares(lesson: LearnLesson) {
  return [lesson.answer.slice(0, 2), lesson.answer.slice(2, 4)];
}

function moveLabel(uci: string) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  return `${from} → ${to}`;
}

function nowMs() {
  return Date.now();
}

function completionPercent(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function recommendedLessonId(userId?: string) {
  if (!userId) return learnLessons[0]?.id ?? "";
  const report = buildAIStudentReport({
    student: {
      id: userId,
      email: "",
      username: "Student",
      city: "",
      country: "",
      avatar: "S",
      rating: 1200,
      bulletRating: 1200,
      blitzRating: 1200,
      rapidRating: 1200,
      classicalRating: 1200,
      puzzleRating: 1200,
      gamesCount: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: new Date().toISOString(),
    },
    games: getSavedGames().filter((game) => game.whiteUserId === userId || game.blackUserId === userId),
    puzzleProgress: getPuzzleState(userId),
  });

  if (report.weakestThemes.some((item) => item.toLowerCase().includes("fork"))) {
    return "tactics-fork";
  }
  if (report.weakestThemes.some((item) => item.toLowerCase().includes("queen"))) {
    return "mistakes-queen-early";
  }
  if (report.weakestThemes.some((item) => item.toLowerCase().includes("time"))) {
    return "opening-castle-early";
  }
  return learnLessons[0]?.id ?? "";
}

function LearnWorkspace({ userId }: { userId?: string }) {
  const assignments = useMemo(() => getAssignments(), []);
  const [assignmentProgress, setAssignmentProgressState] = useState(() => getAssignmentProgress());
  const [progress, setProgress] = useState<Record<string, LessonProgress>>(() => getLessonProgress(userId));
  const [selectedCourseId, setSelectedCourseId] = useState(learnCourses[0]?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(
    recommendedLessonId(userId) || learnLessons[0]?.id || "",
  );
  const [practicePosition, setPracticePosition] = useState(() => learnLessons[0]?.fen ?? new Chess().fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [practiceMessage, setPracticeMessage] = useState(
    "Read the theory, review the example, then solve the mini task on the board.",
  );
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [highlightSquares, setHighlightSquares] = useState<string[]>([]);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [examplePly, setExamplePly] = useState(0);
  const [lessonStartedAt, setLessonStartedAt] = useState(() => nowMs());

  const selectedCourse =
    learnCourses.find((course) => course.id === selectedCourseId) ?? learnCourses[0];
  const courseLessons = lessonsForCourse(selectedCourse.id);
  const lesson =
    learnLessons.find((item) => item.id === selectedLessonId) ?? courseLessons[0] ?? learnLessons[0];
  const lessonProgress = normalizeProgress(progress[lesson.id]);
  const selectedTargets = selectedSquare
    ? new Chess(practicePosition).moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to)
    : [];
  const exampleMoves = lesson.exampleMoves ?? [];
  const exampleFen = replayExampleFen(lesson.exampleFen ?? lesson.fen, exampleMoves, examplePly);
  const assignedLessonProgress = assignmentProgress
    .filter((item) => item.studentId === userId)
    .map((item) => ({
      progress: item,
      assignment: assignments.find((assignment) => assignment.id === item.assignmentId),
    }))
    .filter((item) => item.assignment?.type === "lessons" && item.assignment.lessonId);
  const assignedLessons = assignedLessonProgress
    .map((item) => ({
      lesson: learnLessons.find((lessonItem) => lessonItem.id === item.assignment?.lessonId),
      progress: item.progress,
      assignment: item.assignment,
    }))
    .filter((item) => item.lesson);
  const completedLessonsCount = Object.values(progress).filter((item) => item.completed).length;
  const overallProgress = completionPercent(completedLessonsCount, learnLessons.length);

  const courseCards = learnCourses.map((course) => {
    const lessons = lessonsForCourse(course.id);
    const done = lessons.filter((item) => normalizeProgress(progress[item.id]).completed).length;
    const percent = completionPercent(done, lessons.length);
    return { course, lessons, done, percent };
  });

  const recommendedLesson =
    learnLessons.find((item) => item.id === recommendedLessonId(userId)) ?? learnLessons[0];

  function persistProgress(next: Record<string, LessonProgress>) {
    setProgress(next);
    setLessonProgress(next, userId);
  }

  function persistAssignmentProgress(next: typeof assignmentProgress) {
    setAssignmentProgressState(next);
    saveAssignmentProgress(next);
  }

  function openLesson(nextLesson: LearnLesson, nextCourseId = nextLesson.courseId) {
    setSelectedCourseId(nextCourseId);
    setSelectedLessonId(nextLesson.id);
    setPracticePosition(nextLesson.fen);
    setSelectedSquare(null);
    setPracticeSolved(false);
    setHighlightSquares([]);
    setQuizChoice(null);
    setQuizFeedback("");
    setExamplePly(0);
    setPracticeMessage(nextLesson.task);
    setLessonStartedAt(nowMs());

    const current = normalizeProgress(progress[nextLesson.id]);
    if (!current.started && userId) {
      const next = {
        ...progress,
        [nextLesson.id]: {
          ...current,
          started: true,
          startedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
      };
      persistProgress(next);
      logStudentActivity({
        userId,
        type: "started_lesson",
        title: `Started lesson: ${nextLesson.title}`,
        relatedId: nextLesson.id,
        details: learnCourses.find((course) => course.id === nextLesson.courseId)?.title,
      });
    }
  }

  function changeCourse(courseId: string) {
    const nextCourse = learnCourses.find((course) => course.id === courseId);
    if (!nextCourse) return;
    const firstLesson = lessonsForCourse(courseId)[0];
    if (!firstLesson) return;
    openLesson(firstLesson, courseId);
  }

  function resetPractice() {
    setPracticePosition(lesson.fen);
    setSelectedSquare(null);
    setHighlightSquares([]);
    setPracticeSolved(false);
    setPracticeMessage(lesson.task);
  }

  function showHint() {
    const [from] = expectedSquares(lesson);
    setSelectedSquare(from);
    setHighlightSquares([from]);
    setPracticeMessage(`Hint: ${lesson.hint}`);
  }

  function showAnswer() {
    const squares = expectedSquares(lesson);
    setSelectedSquare(squares[0]);
    setHighlightSquares(squares);
    setPracticeMessage(`Solution: ${moveLabel(lesson.answer)}. ${lesson.success}`);
  }

  function completeLessonIfReady() {
    if (!practiceSolved || quizChoice !== lesson.quizAnswer || !userId) return;
    const current = normalizeProgress(progress[lesson.id]);
    if (!current.completed) {
      const timeSpentMs = (current.timeSpentMs ?? 0) + (nowMs() - lessonStartedAt);
      const next = {
        ...progress,
        [lesson.id]: {
          ...current,
          started: true,
          completed: true,
          quizPassed: true,
          attempts: current.attempts + 1,
          completedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          timeSpentMs,
        },
      };
      persistProgress(next);
      logStudentActivity({
        userId,
        type: "completed_lesson",
        title: `Completed lesson: ${lesson.title}`,
        relatedId: lesson.id,
        details: learnCourses.find((course) => course.id === lesson.courseId)?.title,
        metadata: {
          timeSpentMs,
        },
      });

      const nextAssignmentProgress = assignmentProgress.map((item) => {
        const assignment = assignments.find((assignmentItem) => assignmentItem.id === item.assignmentId);
        if (
          assignment?.type === "lessons" &&
          assignment.lessonId === lesson.id &&
          item.studentId === userId &&
          item.status !== "completed"
        ) {
          return {
            ...item,
            status: "completed" as const,
            completionPercent: 100,
            completedCount: 1,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
        return item;
      });
      persistAssignmentProgress(nextAssignmentProgress);
    }
  }

  function checkQuiz(optionIndex: number) {
    setQuizChoice(optionIndex);
    if (optionIndex === lesson.quizAnswer) {
      setQuizFeedback("Correct. The quiz is passed.");
    } else {
      setQuizFeedback("Not quite. Read the theory summary and try again.");
    }
  }

  function nextLesson() {
    const index = courseLessons.findIndex((item) => item.id === lesson.id);
    const next = courseLessons[index + 1] ?? learnLessons.find((item) => item.courseId !== lesson.courseId) ?? courseLessons[0];
    if (next) openLesson(next, next.courseId);
  }

  function tryMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare) return false;
    const chess = new Chess(practicePosition);
    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: lesson.answer[4] || "q",
      });
      const code = moveCode(move);
      const correct = code === lesson.answer || `${move.from}${move.to}` === lesson.answer;
      if (!correct) {
        setHighlightSquares([move.from, move.to]);
        setSelectedSquare(null);
        setPracticeMessage("That move is legal, but it does not solve the lesson task.");
        return false;
      }
      setPracticePosition(chess.fen());
      setHighlightSquares([move.from, move.to]);
      setSelectedSquare(null);
      setPracticeSolved(true);
      setPracticeMessage(`Success: ${lesson.success}`);
      return true;
    } catch {
      setPracticeMessage("That move is illegal in this lesson position.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    const chess = new Chess(practicePosition);
    const piece = chess.get(square as Square);

    if (selectedSquare && selectedTargets.includes(square as Square)) {
      void tryMove(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setHighlightSquares([]);
      setPracticeMessage("Now choose the destination square.");
      return;
    }

    setSelectedSquare(null);
  }

  const squareStyles = Object.fromEntries([
    ...(selectedSquare ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.58)" }]] : []),
    ...selectedTargets.map((target) => [
      target,
      {
        background: "radial-gradient(circle, rgba(31, 122, 77, 0.48) 24%, transparent 27%)",
      },
    ]),
    ...highlightSquares.map((square) => [
      square,
      { background: "rgba(240, 184, 77, 0.68)" },
    ]),
  ]);

  return (
    <div className="grid gap-6">
      <Card className="rounded-[2.5rem]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Badge>Learn</Badge>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Interactive chess academy</h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Theory, visual board examples, mini tasks, quizzes, and progress tracking. Teachers
              can assign lessons, and students can complete them right inside the site.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border bg-muted p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                My Progress
              </p>
              <p className="mt-2 font-mono text-4xl font-black">{overallProgress}%</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {completedLessonsCount}/{learnLessons.length} lessons completed
            </p>
            <p className="text-sm text-muted-foreground">
              Recommended next lesson: <span className="font-semibold text-foreground">{recommendedLesson.title}</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {courseCards.map(({ course, lessons, done, percent }) => (
          <button
            type="button"
            key={course.id}
            onClick={() => changeCourse(course.id)}
            className={cn(
              "rounded-[2rem] border bg-card/88 p-5 text-left shadow-xl shadow-black/5 transition hover:-translate-y-0.5",
              selectedCourse.id === course.id && "border-primary bg-primary/10",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <Badge>{course.level}</Badge>
              <span className="text-xs font-semibold text-muted-foreground">{lessons.length} lessons</span>
            </div>
            <h2 className="mt-3 text-2xl font-black">{course.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Progress {percent}% • {done}/{lessons.length}
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">
              {done > 0 ? "Continue" : "Start course"}
            </p>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <Card className="content-start">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black">{selectedCourse.title}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{selectedCourse.section}</p>
          <div className="mt-5 grid gap-2">
            {courseLessons.map((item, index) => {
              const itemProgress = normalizeProgress(progress[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openLesson(item)}
                  className={cn(
                    "rounded-2xl border bg-muted/50 p-3 text-left transition hover:-translate-y-0.5",
                    item.id === lesson.id && "border-primary bg-primary/15",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {index + 1}. {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.level}</p>
                    </div>
                    {itemProgress.completed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="grid min-w-0 gap-6">
          <Card className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedCourse.title}</Badge>
                  <Badge>{lesson.level}</Badge>
                  <Badge>{lessonProgress.completed ? "Completed" : lessonProgress.started ? "In progress" : "Not started"}</Badge>
                </div>
                <h2 className="mt-3 text-3xl font-black">{lesson.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{lesson.intro}</p>
              </div>
              <Button variant="secondary" onClick={nextLesson}>
                Next lesson
              </Button>
            </div>

            <div className="mt-6 grid items-start gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
              <div className="grid gap-6">
                <div className="rounded-[2rem] bg-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">Interactive board example</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setExamplePly((current) => Math.max(0, current - 1))}
                        disabled={examplePly <= 0}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setExamplePly((current) => Math.min(exampleMoves.length, current + 1))}
                        disabled={examplePly >= exampleMoves.length}
                      >
                        <ChevronRight className="mr-2 h-4 w-4" />
                        Next
                      </Button>
                      <Button variant="secondary" onClick={() => setExamplePly(0)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Replay
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Step-by-step example: {exampleMoves.length ? `${examplePly}/${exampleMoves.length}` : "No moves"}
                  </p>
                  <div className="mt-4 mx-auto max-w-[min(60vh,520px)]">
                    <Chessboard
                      options={{
                        position: exampleFen,
                        boardOrientation: lesson.sideToMove,
                        boardStyle: {
                          borderRadius: "1.5rem",
                          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
                          overflow: "hidden",
                        },
                        lightSquareStyle: { backgroundColor: "#e8d4aa" },
                        darkSquareStyle: { backgroundColor: "#58764a" },
                      }}
                    />
                  </div>
                  {exampleMoves.length ? (
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      {exampleMoves.map((move, index) => (
                        <Badge key={`${move}-${index}`} className={cn(index < examplePly && "bg-primary/20 text-foreground")}>
                          {index + 1}. {moveLabel(move)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[2rem] bg-muted p-4">
                  <p className="font-semibold">Practice task</p>
                  <p className="mt-2 text-sm text-muted-foreground">{lesson.task}</p>
                  <div className="mt-4 mx-auto max-w-[min(72vh,640px)]">
                    <Chessboard
                      options={{
                        position: practicePosition,
                        boardOrientation: lesson.sideToMove,
                        onPieceDrop: ({ sourceSquare, targetSquare }) => tryMove(sourceSquare, targetSquare),
                        onSquareClick,
                        squareStyles,
                        boardStyle: {
                          borderRadius: "1.5rem",
                          boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
                          overflow: "hidden",
                        },
                        lightSquareStyle: { backgroundColor: "#e8d4aa" },
                        darkSquareStyle: { backgroundColor: "#58764a" },
                      }}
                    />
                  </div>
                  <p className="mt-4 rounded-2xl bg-card p-4 text-sm leading-6">{practiceMessage}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={showHint}>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      Hint
                    </Button>
                    <Button variant="secondary" onClick={showAnswer}>
                      Show solution
                    </Button>
                    <Button variant="secondary" onClick={resetPractice}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 content-start gap-4">
                <Card>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Theory
                  </p>
                  <h3 className="mt-3 text-xl font-black">What this lesson teaches</h3>
                  <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
                    {lesson.theory.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2">
                    {lesson.rules.map((item) => (
                      <div key={item} className="rounded-2xl bg-muted p-3 text-sm">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-xl font-black">Quiz</h3>
                  </div>
                  <p className="mt-3 text-sm font-medium">{lesson.quizQuestion}</p>
                  <div className="mt-4 grid gap-2">
                    {lesson.quizOptions.map((option, index) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => checkQuiz(index)}
                        className={cn(
                          "rounded-2xl border bg-muted p-3 text-left text-sm transition hover:-translate-y-0.5",
                          quizChoice === index && "border-primary bg-primary/10",
                        )}
                      >
                        {String.fromCharCode(65 + index)}. {option}
                      </button>
                    ))}
                  </div>
                  {quizFeedback ? (
                    <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{quizFeedback}</p>
                  ) : null}
                  <Button
                    className="mt-4 w-full"
                    onClick={completeLessonIfReady}
                    disabled={!practiceSolved || quizChoice !== lesson.quizAnswer || lessonProgress.completed}
                  >
                    {lessonProgress.completed ? "Lesson completed" : "Complete lesson"}
                  </Button>
                </Card>

                <Card>
                  <h3 className="text-xl font-black">Summary</h3>
                  <div className="mt-4 grid gap-2">
                    {lesson.summary.map((item) => (
                      <div key={item} className="rounded-2xl bg-muted p-3 text-sm">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </Card>
        </div>

        <aside className="grid min-w-0 content-start gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-black">My progress</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {courseCards.map(({ course, done, lessons, percent }) => (
                <div key={course.id} className="rounded-2xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{course.title}</p>
                    <Badge>{percent}%</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {done}/{lessons.length} lessons completed
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-black">Teacher assignments</h2>
            <div className="mt-4 grid gap-3">
              {assignedLessons.map((item) => (
                <button
                  type="button"
                  key={item.assignment?.id}
                  onClick={() => openLesson(item.lesson as LearnLesson)}
                  className="rounded-2xl bg-muted p-4 text-left"
                >
                  <p className="font-semibold">{item.assignment?.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.lesson?.title} • Due{" "}
                    {item.assignment?.dueDate ? formatDate(item.assignment.dueDate) : "No due date"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.progress.status === "completed" ? "Completed" : "Open"}
                  </p>
                </button>
              ))}
              {!assignedLessons.length ? (
                <p className="text-sm text-muted-foreground">
                  No lesson assignments yet. Your teacher can assign lessons from the classroom.
                </p>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function LearnPage() {
  const { user } = useAuth();
  return <LearnWorkspace key={user?.id ?? "guest"} userId={user?.id} />;
}
