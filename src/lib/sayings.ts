export const SAYINGS = [
  "What's rattling around in your head?",
  "The worm is listening. What's the spark?",
  "Fear is a tell. What's the idea?",
  "The desert doesn't care. What are we making?",
  "A tremor in the force. Name it.",
  "The hyperdrive is waiting. Where to?",
  "This is the spark you're looking for.",
  "Make it so. After you say what it is.",
  "Engage. What's on the board?",
  "The holodeck is empty. Load a program.",
  "Floor one just opened. What's the run?",
  "The dungeon issued a ticket. Read it out.",
  "Don't pet the loot. Type the build.",
  "The AI is watching. Make it interesting.",
  "Frak it. Type the thing.",
  "Jump complete. What's the next problem?",
  "So. What are we actually doing?",
  "Something's coming down the well. Say it.",
  "The Belt doesn't wait. What's the job?",
  "Keep the air. Spend the idea.",
  "Roll for a spark.",
  "All this power and you're still staring.",
  "A sitting. A strange object. Go.",
  "Set a course. Or just type.",
  "The spice is a rumor. The build is real.",
  "There are only so many vipers. Pick a fight.",
  "Second star to the left. Or this box.",
  "The crawler has one shot. Don't waste it.",
  "No gods, no kings. One spark.",
  "Live a little. What's the weird one?",
] as const;

const STORE = "foundry.saying";

export function pickSaying(): string {
  const pool = [...SAYINGS];
  if (typeof window !== "undefined") {
    try {
      const last = sessionStorage.getItem(STORE);
      const filtered = last ? pool.filter((s) => s !== last) : pool;
      const next = filtered[Math.floor(Math.random() * filtered.length)] ?? pool[0];
      sessionStorage.setItem(STORE, next);
      return next;
    } catch {
      /* ignore */
    }
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}
