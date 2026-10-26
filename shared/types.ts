export const ACCOUNT_TYPES = {
  savings: "Savings account",
  salary: "Salary account",
  current: "Current account",
  card: "Credit card",
  cash: "Cash",
  wallet: "Wallet / UPI",
} as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening: number;
  /** Credit cards: bill due day of month (null = no bill reminder). */
  dueDay: number | null;
  /** Credit cards: the bank account the bill is usually paid from. */
  payFromId: string | null;
  sample: boolean;
  createdAt?: number;
}

export type TxnType = "income" | "expense" | "transfer";
export type TxnKind = "emi" | "chit" | "chitprize" | "sip" | "card" | "debt";

export interface Txn {
  id: string;
  type: TxnType;
  amount: number;
  date: string; // YYYY-MM-DD
  accountId: string | null;
  toAccountId: string | null;
  category: string;
  note: string;
  kind: TxnKind | null;
  emiId: string | null;
  chitId: string | null;
  sipId: string | null;
  debtId: string | null;
  period: string | null; // YYYY-MM the installment (or card bill) belongs to
  chitDue: number | null; // full chitty installment, to derive the dividend
  sample: boolean;
  createdAt?: number;
}

export interface Emi {
  id: string;
  name: string;
  lender: string;
  emi: number;
  dueDay: number;
  startDate: string; // YYYY-MM of the first EMI
  tenure: number;
  paidBefore: number;
  loanAmount: number;
  accountId: string | null;
  closed: boolean;
  sample: boolean;
  createdAt?: number;
}

export interface Chit {
  id: string;
  name: string;
  company: string;
  chitValue: number; // sala
  installment: number;
  months: number;
  dueDay: number;
  startDate: string; // YYYY-MM of the first installment
  accountId: string | null;
  paidBefore: number;
  paidBeforeAmount: number | null;
  sample: boolean;
  createdAt?: number;
}

export interface Sip {
  id: string;
  name: string; // fund / scheme
  platform: string; // AMC, broker or app
  amount: number;
  dueDay: number;
  startDate: string; // YYYY-MM of the first installment
  months: number; // 0 = no end date
  paidBefore: number;
  investedBefore: number | null; // amount for those; null = paidBefore × amount
  accountId: string | null;
  stopped: boolean;
  sample: boolean;
  createdAt?: number;
}

/** Money lent to or borrowed from a person. Amounts live in txns (kind "debt"). */
export interface Debt {
  id: string;
  person: string;
  direction: "lent" | "borrowed";
  note: string;
  dueDate: string | null; // YYYY-MM-DD the money should come back / be repaid
  closed: boolean; // settled or written off by hand
  sample: boolean;
  createdAt?: number;
}

export interface Settings {
  expenseCats: string[];
  incomeCats: string[];
  reminderDays: number;
}

export interface Ledger {
  accounts: Account[];
  txns: Txn[];
  emis: Emi[];
  chits: Chit[];
  sips: Sip[];
  debts: Debt[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  expenseCats: [
    "Groceries", "Dining out", "Fuel & transport", "Rent", "Electricity & water", "Mobile & internet",
    "Shopping", "Health & medical", "Education", "Insurance", "Entertainment", "Travel",
    "Family & gifts", "Personal care", "Household", "Other",
  ],
  incomeCats: ["Salary", "Consulting / freelance", "Interest", "Refund", "Gift", "Other"],
  reminderDays: 2,
};

/** Categories the app assigns itself; always available, never deletable. */
export const SYS_EXP = ["EMI", "Chitty", "SIP"];
export const SYS_INC = ["Chitty prize"];
