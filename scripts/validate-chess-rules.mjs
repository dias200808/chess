import { strict as assert } from "node:assert";
import { Chess } from "chess.js";

function moveOk(fen, move) {
  const chess = fen === START ? new Chess() : new Chess(fen);
  return chess.move(move);
}

function moveFails(fen, move) {
  const chess = fen === START ? new Chess() : new Chess(fen);
  try {
    chess.move(move);
    return false;
  } catch {
    return true;
  }
}

function play(moves) {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  return chess;
}

const START = "start";

assert.ok(moveOk(START, { from: "e2", to: "e4" }), "pawn moves");
assert.ok(moveOk(START, { from: "g1", to: "f3" }), "knight moves");
assert.ok(moveOk("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", {
  from: "f1",
  to: "c4",
}), "bishop moves");
assert.ok(moveOk("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", {
  from: "a1",
  to: "a8",
}), "rook moves");
assert.ok(moveOk("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", {
  from: "d1",
  to: "h5",
}), "queen moves");
assert.ok(moveOk("4k3/8/8/8/8/8/8/4K3 w - - 0 1", {
  from: "e1",
  to: "e2",
}), "king moves");

assert.ok(moveOk("4k3/8/8/8/8/4n3/3P4/4K3 w - - 0 1", {
  from: "d2",
  to: "e3",
}), "captures pieces");
assert.ok(moveFails(START, { from: "e2", to: "e5" }), "illegal moves are rejected");
assert.ok(moveFails(START, { from: "a7", to: "a6" }), "cannot move opponent piece");
assert.ok(moveFails("4r1k1/8/8/8/8/8/3P4/4K3 w - - 0 1", {
  from: "d2",
  to: "d3",
}), "cannot ignore check on own king");

const check = new Chess("4k3/8/8/8/8/8/8/K3R3 b - - 0 1");
assert.equal(check.isCheck(), true, "check works");

const mate = play(["f3", "e5", "g4", "Qh4#"]);
assert.equal(mate.isCheckmate(), true, "checkmate works");

const stalemate = new Chess("7k/5Q2/7K/8/8/8/8/8 b - - 0 1");
assert.equal(stalemate.isStalemate(), true, "stalemate works");

assert.ok(moveOk("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", {
  from: "e1",
  to: "g1",
}), "short castling works");
assert.ok(moveOk("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", {
  from: "e1",
  to: "c1",
}), "long castling works");

const enPassant = moveOk("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", {
  from: "e5",
  to: "d6",
});
assert.equal(enPassant.captured, "p", "en passant captures pawn");

for (const promotion of ["q", "r", "b", "n"]) {
  assert.ok(moveOk("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", {
    from: "a7",
    to: "a8",
    promotion,
  }), `promotion to ${promotion} works`);
}

const insufficient = new Chess("8/8/8/8/8/8/8/K1k5 w - - 0 1");
assert.equal(insufficient.isInsufficientMaterial(), true, "insufficient material draw works");

const repetition = play(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
assert.equal(repetition.isThreefoldRepetition(), true, "threefold repetition draw works");

const fiftyMove = new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 100 75");
assert.equal(fiftyMove.isDraw(), true, "50-move rule draw works");

console.log("Chess rules validation passed.");
