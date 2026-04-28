import { useAppStore } from "./store/useAppStore";
import { Wizard } from "./components/Wizard";
import { Header } from "./components/Header";
import { Main } from "./components/Main";
import { Result } from "./components/Result";

export default function App() {
  const screen = useAppStore((s) => s.screen);

  return (
    <div className="flex min-h-screen flex-col">
      {screen !== "wizard" && <Header />}
      <main className="flex-1">
        {screen === "wizard" && <Wizard />}
        {screen === "main" && <Main />}
        {screen === "result" && <Result />}
      </main>
      <footer className="border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-500 dark:border-slate-800">
        Slide Forge — open source · MIT License ·{" "}
        <a
          href="https://github.com/kento-cell/slide-forge"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-navy-700"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
