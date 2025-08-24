export class ClockService {
  private whiteTime: number;
  private blackTime: number;
  private increment: number;
  private lastUpdate: number;
  private turn: "w" | "b";

  constructor(minutes: number, incrementSeconds: number) {
    this.whiteTime = minutes * 60 * 1000;
    this.blackTime = minutes * 60 * 1000;
    this.increment = incrementSeconds * 1000;
    this.lastUpdate = Date.now();
    this.turn = "w";
  }

  switchTurn() {
    const now = Date.now();
    const elapsed = now - this.lastUpdate;

    if (this.turn === "w") {
      this.whiteTime -= elapsed;
      this.whiteTime += this.increment;
      this.turn = "b";
    } else {
      this.blackTime -= elapsed;
      this.blackTime += this.increment;
      this.turn = "w";
    }

    this.lastUpdate = now;
  }

  getTimes() {
    const now = Date.now();
    const elapsed = now - this.lastUpdate;

    return {
      white: this.turn === "w" ? this.whiteTime - elapsed : this.whiteTime,
      black: this.turn === "b" ? this.blackTime - elapsed : this.blackTime,
    };
  }

  isFlagged() {
    const times = this.getTimes();
    if (times.white <= 0) return "white";
    if (times.black <= 0) return "black";
    return null;
  }
}