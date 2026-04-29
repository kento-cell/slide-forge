/**
 * Single styling source for "go back" navigation across the app.
 * Wizard sub-stages, Main, and Result all use this so the affordance
 * is uniformly visible and discoverable.
 *
 * The original anchor-style "← 戻る" link was easy to miss
 * (slate-500 underline-on-hover); switching everything to a bordered
 * button surfaces the action and prevents users from feeling stuck
 * on a sub-screen.
 */
type Props = {
  onClick: () => void;
  label: string;
  /** Adds extra bottom margin when used as a top-of-page navigation. */
  topNav?: boolean;
};

export function BackButton({ onClick, label, topNav = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-md border border-slate-300",
        "bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm",
        "hover:border-navy-400 hover:bg-navy-50 hover:text-navy-700",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
        "dark:hover:border-navy-500 dark:hover:bg-slate-800",
        topNav ? "mb-3" : "",
      ].join(" ")}
    >
      ← {label}
    </button>
  );
}
