import { tx } from "./db";
import { env } from "./env";
import { insert } from "./repo";
import { addMonths, pad, todayIn } from "../shared/finance";

/** Inserts clearly marked example data, dated relative to the current month. */
export async function seedExamples(): Promise<number> {
  const today = todayIn(env.timeZone);
  const m0 = today.slice(0, 7);
  const dom = Number(today.slice(8, 10));
  const m = (off: number) => addMonths(m0, off);
  const d = (off: number, day: number) => `${m(off)}-${pad(Math.min(day, 28))}`;
  const carDue = Math.min(dom + 2, 28); // makes the reminder banner show up
  const chitDue = Math.min(dom + 4, 28);

  return tx(async (c) => {
    const ids: Record<string, string> = {};
    const acc = async (key: string, name: string, type: string, opening: number) =>
      (ids[key] = (await insert("accounts", { name, type, opening, sample: true }, c)).id);
    await acc("fed", "Federal Bank savings", "savings", 42000);
    await acc("sbi", "SBI salary", "salary", 18000);
    await acc("cash", "Cash in hand", "cash", 2500);
    await acc("cc", "HDFC credit card", "card", 0);

    const car = (await insert("emis", { name: "Car loan", lender: "Federal Bank", emi: 14500, dueDay: carDue, startDate: m(-19), tenure: 60, paidBefore: 17, loanAmount: 650000, accountId: ids.fed, sample: true }, c)).id;
    const phone = (await insert("emis", { name: "Phone EMI", lender: "Bajaj Finance", emi: 3200, dueDay: 5, startDate: m(-6), tenure: 12, paidBefore: 4, accountId: ids.sbi, sample: true }, c)).id;
    const chit = (await insert("chits", { name: "KSFE 5 lakh chitty", company: "KSFE", chitValue: 500000, installment: 10000, months: 50, dueDay: chitDue, startDate: m(-10), accountId: ids.fed, paidBefore: 8, paidBeforeAmount: 74200, sample: true }, c)).id;

    type Row = [number, number, string, number, string, string, string, Record<string, unknown>?];
    const rows: Row[] = [];
    for (const off of [-2, -1, 0]) {
      rows.push(
        [off, 1, "income", 95000, "sbi", "Salary", `${off === 0 ? "This month's" : "Monthly"} salary`],
        [off, 2, "transfer", 60000, "sbi", "Transfer", "Move to savings", { toAccountId: ids.fed }],
        [off, 7, "expense", 5400 + off * -800, "fed", "Groceries", "Lulu hypermarket"],
        [off, 9, "expense", 3600, "cc", "Fuel & transport", "Petrol"],
        [off, 12, "expense", 2650, "fed", "Electricity & water", "KSEB bill"],
        [off, 20, "expense", 1199, "sbi", "Mobile & internet", "Broadband"],
      );
      rows.push([off, 5, "expense", 3200, "sbi", "EMI", "Phone EMI", { kind: "emi", emiId: phone, period: m(off) }]);
      if (off < 0) {
        rows.push([off, carDue, "expense", 14500, "fed", "EMI", "Car loan", { kind: "emi", emiId: car, period: m(off) }]);
        rows.push([off, chitDue, "expense", off === -2 ? 9150 : 9300, "fed", "Chitty", "KSFE 5 lakh chitty", { kind: "chit", chitId: chit, period: m(off), chitDue: 10000 }]);
      }
    }
    rows.push(
      [-2, 18, "income", 25000, "fed", "Consulting / freelance", "Website project payment"],
      [-2, 22, "expense", 12500, "cc", "Shopping", "Festival shopping"],
      [-1, 3, "transfer", 5000, "fed", "Transfer", "ATM withdrawal", { toAccountId: ids.cash }],
      [-1, 15, "expense", 2400, "cash", "Health & medical", "Pharmacy"],
      [-1, 18, "expense", 8400, "fed", "Insurance", "LIC premium"],
      [-1, 27, "income", 640, "fed", "Interest", "Savings interest"],
      [0, 10, "transfer", 25000, "fed", "Transfer", "Credit card bill", { toAccountId: ids.cc }],
      [0, 15, "expense", 1850, "cash", "Dining out", "Lunch with team"],
    );

    let n = 7;
    for (const [off, day, type, amount, key, category, note, extra] of rows) {
      const date = d(off, day);
      if (date > today) continue;
      await insert("txns", { type, amount, date, accountId: ids[key], category, note, sample: true, ...extra }, c);
      n++;
    }
    return n;
  });
}
