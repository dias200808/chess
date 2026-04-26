"use client";

import { Chessboard } from "@/components/client-chessboard";
import { Badge, Card } from "@/components/ui";
import { lessons } from "@/lib/data";

export default function LearnPage() {
  return (
    <div className="grid gap-6">
      <Card>
        <Badge>Lessons</Badge>
        <h1 className="mt-2 text-3xl font-black">Learning section</h1>
        <p className="mt-2 text-muted-foreground">
          Short lessons with board examples, mini tasks, and completion-ready lesson cards.
        </p>
      </Card>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => (
          <Card key={lesson.title}>
            <Badge>Not completed</Badge>
            <h2 className="mt-3 text-xl font-black">{lesson.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lesson.explanation}</p>
            <div className="mt-4 overflow-hidden rounded-3xl">
              <Chessboard
                options={{
                  position: lesson.fen,
                  allowDragging: false,
                  showNotation: false,
                  boardStyle: { borderRadius: "1.5rem", overflow: "hidden" },
                  lightSquareStyle: { backgroundColor: "#e8d4aa" },
                  darkSquareStyle: { backgroundColor: "#58764a" },
                }}
              />
            </div>
            <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-medium">{lesson.task}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
