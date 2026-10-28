// Daily LLM token budget (in-memory, resets at UTC midnight).
// Set DAILY_TOKEN_BUDGET in the environment; 0 or absent = default below.
let dayKey = "";
let usedTokens = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function roll(): void {
  const t = today();
  if (t !== dayKey) {
    dayKey = t;
    usedTokens = 0;
  }
}

export function dailyBudget(): number {
  const raw = Number(process.env.DAILY_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : 5_000_000;
}

export function addTokenUsage(prompt = 0, completion = 0): void {
  roll();
  usedTokens += (prompt || 0) + (completion || 0);
  console.log(
    `llm budget: ${usedTokens}/${dailyBudget()} tokens today`,
  );
}

export function overDailyBudget(): boolean {
  roll();
  return usedTokens >= dailyBudget();
}
