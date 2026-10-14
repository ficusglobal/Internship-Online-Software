export function cn(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(" "); }
export function formatCurrency(amount: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount); }
