"use client";

import { useMemo, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { CheckCircle2, Lightbulb, RotateCcw } from "lucide-react";
import { Chessboard } from "@/components/client-chessboard";
import { Badge, Button, Card, SelectField } from "@/components/ui";
import { lessons } from "@/lib/data";
import type { Lesson } from "@/lib/types";
import { cn } from "@/lib/utils";

const LESSON_PROGRESS_KEY = "knightly.lesson-progress";

function readCompletedLessons() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveCompletedLessons(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify(value));
}

function moveCode(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function expectedSquares(lesson: Lesson) {
  return [lesson.answer.slice(0, 2), lesson.answer.slice(2, 4)];
}

export default function LearnPage() {
  const categories = ["all", ...Array.from(new Set(lessons.map((lesson) => lesson.category)))];
  const [category, setCategory] = useState("all");
  const [selectedLessonId, setSelectedLessonId] = useState(lessons[0]?.id ?? "");
  const [position, setPosition] = useState(lessons[0]?.fen ?? "start");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<string[]>([]);
  const [message, setMessage] = useState("Choose a lesson, read the task, then make the move on the board.");
  const [completed, setCompleted] = useState(() => readCompletedLessons());

  const visibleLessons = useMemo(
    () => lessons.filter((lesson) => category === "all" || lesson.category === category),
    [category],
  );
  const lesson =
    lessons.find((item) => item.id === selectedLessonId) ??
    visibleLessons[0] ??
    lessons[0];
  const selectedTargets = selectedSquare
    ? new Chess(position).moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to)
    : [];
  const completedCount = lessons.filter((item) => completed[item.id]).length;
  const progress = Math.round((completedCount / lessons.length) * 100);

  function openLesson(nextLesson: Lesson) {
    setSelectedLessonId(nextLesson.id);
    setPosition(nextLesson.fen);
    setSelectedSquare(null);
    setHighlightSquares([]);
    setMessage(nextLesson.task);
  }

  function changeCategory(nextCategory: string) {
    const nextLessons = lessons.filter((item) => nextCategory === "all" || item.category === nextCategory);
    setCategory(nextCategory);
    if (nextLessons[0]) openLesson(nextLessons[0]);
  }

  function markCompleted(lessonId: string) {
    const next = { ...completed, [lessonId]: true };
    setCompleted(next);
    saveCompletedLessons(next);
  }

  function tryMove(sourceSquare: string, targetSquare: string | null) {
    if (!targetSquare) return false;
    const chess = new Chess(position);

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: lesson.answer[4] || "q",
      });
      const code = moveCode(move);
      const correct = code === lesson.answer || `${move.from}${move.to}` === lesson.answer;

      if (!correct) {
        setSelectedSquare(null);
        setHighlightSquares([move.from, move.to]);
        setMessage("Error: that move is legal, but it does not solve this mini-task. Use the hint and try again.");
        return false;
      }

      setPosition(chess.fen());
      setSelectedSquare(null);
      setHighlightSquares([move.from, move.to]);
      markCompleted(lesson.id);
      setMessage(`Success: ${lesson.success}`);
      return true;
    } catch {
      setMessage("Error: that move is illegal in this position.");
      return false;
    }
  }

  function onSquareClick({ square }: { square: string }) {
    const chess = new Chess(position);
    const piece = chess.get(square as Square);

    if (selectedSquare && selectedTargets.includes(square as Square)) {
      tryMove(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setHighlightSquares([]);
      setMessage("Now choose the destination square.");
      return;
    }

    setSelectedSquare(null);
  }

  function resetLesson() {
    setPosition(lesson.fen);
    setSelectedSquare(null);
    setHighlightSquares([]);
    setMessage(lesson.task);
  }

  function showHint() {
    const [source] = expectedSquares(lesson);
    setSelectedSquare(source);
    setHighlightSquares([source]);
    setMessage(`Hint: ${lesson.hint}`);
  }

  function showAnswer() {
    const squares = expectedSquares(lesson);
    setSelectedSquare(squares[0]);
    setHighlightSquares(squares);
    setMessage(`Solution: ${squares[0]}-${squares[1]}. ${lesson.success}`);
  }

  function nextLesson() {
    const source = visibleLessons.length ? visibleLessons : lessons;
    const currentIndex = source.findIndex((item) => item.id === lesson.id);
    openLesson(source[(currentIndex + 1) % source.length] ?? lessons[0]);
  }

  const squareStyles = Object.fromEntries([
    ...(selectedSquare
      ? [[selectedSquare, { background: "rgba(96, 197, 141, 0.58)" }]]
      : []),
    ...selectedTargets.map((target) => [
      target,
      {
        background:
          "radial-gradient(circle, rgba(31, 122, 77, 0.48) 24%, transparent 27%)",
      },
    ]),
    ...highlightSquares.map((square) => [
      square,
      { background: "rgba(240, 184, 77, 0.68)" },
    ]),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)_24rem]">
      <Card className="content-start">
        <Badge>Lessons</Badge>
        <h1 className="mt-2 text-3xl font-black">Learning</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Interactive lessons with a short explanation, a board task, answer checking, and completed progress.
        </p>
        <div className="mt-5">
          <SelectField label="Topic" value={category} onChange={(event) => changeCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {completedCount}/{lessons.length} completed · {progress}%
        </p>
        <div className="mt-5 grid gap-2">
          {visibleLessons.map((item) => (
            <button
              key={item.id}
              className={cn(
                "rounded-2xl border bg-muted/50 p-3 text-left text-sm transition hover:-translate-y-0.5",
                item.id === lesson.id && "border-primary bg-primary/15",
              )}
              onClick={() => openLesson(item)}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold">{item.title}</span>
                {completed[item.id] ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.category}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{lesson.category}</Badge>
              <Badge>{completed[lesson.id] ? "Completed" : "Not completed"}</Badge>
            </div>
            <h2 className="mt-2 text-3xl font-black">{lesson.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{lesson.explanation}</p>
          </div>
        </div>
        <div className="mx-auto max-w-[min(82vh,720px)]">
          <Chessboard
            options={{
              position,
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
      </Card>

      <aside className="grid gap-4 content-start">
        <Card>
          <h2 className="text-xl font-black">Mini-task</h2>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm font-medium">{lesson.task}</p>
          <p className="mt-3 rounded-2xl bg-muted p-4 text-sm leading-6">{message}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={showHint}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Hint
            </Button>
            <Button variant="secondary" onClick={showAnswer}>
              Show solution
            </Button>
            <Button variant="secondary" onClick={resetLesson}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={nextLesson}>Next lesson</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Progress</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {categories.filter((item) => item !== "all").map((item) => {
              const topicLessons = lessons.filter((lessonItem) => lessonItem.category === item);
              const done = topicLessons.filter((lessonItem) => completed[lessonItem.id]).length;
              return (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item}</span>
                  <span className="font-mono font-bold">{done}/{topicLessons.length}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </aside>
    </div>
  );
}
