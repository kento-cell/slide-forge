import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { PROVIDERS, getProvider, pingProvider } from "../providers";
import { detectOllama, pullOllamaModel } from "../providers/ollama";
import { saveApiKey } from "../lib/secrets";
import { openExternalUrl } from "../lib/openUrl";
import { BackButton } from "./BackButton";
import type { ProviderId } from "../types";

type Stage = "select" | "cloud" | "local";

export function Wizard() {
  const [stage, setStage] = useState<Stage>("select");
  const finishSetup = useAppStore((s) => s.finishSetup);
  const setProvider = useAppStore((s) => s.setProvider);

  if (stage === "select") {
    return (
      <SelectStage
        onCloud={() => setStage("cloud")}
        onLocal={() => setStage("local")}
        onSkip={() => {
          setProvider({ id: "offline" });
          finishSetup();
        }}
      />
    );
  }
  if (stage === "cloud") {
    return <CloudStage onBack={() => setStage("select")} onDone={finishSetup} />;
  }
  return <LocalStage onBack={() => setStage("select")} onDone={finishSetup} />;
}

function SelectStage({
  onCloud,
  onLocal,
  onSkip,
}: {
  onCloud: () => void;
  onLocal: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-head font-bold text-navy-900 dark:text-white">
        Slide Forge へようこそ
      </h1>
      <p className="mb-10 text-slate-600 dark:text-slate-400">
        どの方法で AI を使うか選んでください。あとから設定で変更できます。
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Choice
          icon="☁"
          title="クラウド AI"
          subtitle="無料 API キーを 1 個取得"
          stars={4}
          time="約 1 分"
          notes={["品質高い", "ネット必須", "Gemini 無料枠で実質 ¥0"]}
          accent="navy"
          onClick={onCloud}
        />
        <Choice
          icon="💻"
          title="ローカル AI"
          subtitle="PC 内で完結 (Ollama)"
          stars={3}
          time="約 5〜10 分"
          notes={["完全無料", "オフライン可", "PC スペック依存"]}
          accent="green"
          onClick={onLocal}
        />
        <Choice
          icon="✏"
          title="AI なし"
          subtitle="Markdown を機械的に変換"
          stars={2}
          time="0 秒"
          notes={["設定不要", "シンプル機能のみ", "いつでも切替可"]}
          accent="amber"
          onClick={onSkip}
        />
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">
        どれを選んでも、あとからメイン画面右上の <kbd className="rounded border px-1">⚙</kbd>{" "}
        で再セットアップできます。
      </p>
    </div>
  );
}

function Choice({
  icon,
  title,
  subtitle,
  stars,
  time,
  notes,
  accent,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  stars: number;
  time: string;
  notes: string[];
  accent: "navy" | "green" | "amber";
  onClick: () => void;
}) {
  const ring = {
    navy: "hover:border-navy-700 hover:ring-navy-200",
    green: "hover:border-emerald-600 hover:ring-emerald-100",
    amber: "hover:border-amber-600 hover:ring-amber-100",
  }[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group flex h-full flex-col items-stretch border-2 border-transparent p-6 text-left transition hover:shadow-lg hover:ring-4 ${ring}`}
    >
      <div className="mb-3 text-4xl">{icon}</div>
      <div className="mb-1 font-head text-xl font-bold">{title}</div>
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">{subtitle}</div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-amber-500">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
        <span className="text-slate-500">{time}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
        {notes.map((n) => (
          <li key={n} className="flex gap-2">
            <span>·</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6 text-right text-sm font-bold text-navy-700 group-hover:translate-x-1 transition">
        選択 →
      </div>
    </button>
  );
}

function CloudStage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const setProvider = useAppStore((s) => s.setProvider);
  const cloudProviders = PROVIDERS.filter((p) => p.category === "cloud");
  const [selected, setSelected] = useState<ProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const provider = useMemo(() => getProvider(selected), [selected]);

  useEffect(() => {
    // Reset transient form state when the user switches provider tabs.
    // These are local UI states that don't make sense to carry over.
    /* eslint-disable react-hooks/set-state-in-effect */
    setModel(provider.defaultModel ?? "");
    setTestResult(null);
    setErrMsg(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [provider]);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setErrMsg(null);
    try {
      const ok = await pingProvider({ id: selected, apiKey, model });
      setTestResult(ok ? "ok" : "fail");
      if (!ok) setErrMsg("応答を確認できませんでした。キー・モデル・ネット接続を確認してください。");
    } catch (e) {
      setTestResult("fail");
      setErrMsg(e instanceof Error ? e.message : "接続テストに失敗しました");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    // Persist the key to the OS keychain (or sessionStorage in
    // browser dev). The store keeps it in memory only — see
    // src/lib/storage.ts which strips apiKey before persisting.
    await saveApiKey(selected, apiKey);
    setProvider({ id: selected, apiKey, model });
    onDone();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <BackButton onClick={onBack} label="モード選択に戻る" topNav />
      <h2 className="mb-1 text-2xl font-head font-bold">☁ クラウド AI セットアップ</h2>
      <p className="mb-6 text-sm text-slate-500">
        無料枠が大きい <strong>Gemini</strong> または <strong>Groq</strong> がおすすめ。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {cloudProviders.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              selected === p.id
                ? "bg-navy-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {p.label}{p.free ? " (無料枠)" : ""}
          </button>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          {provider.description}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold">① API キーを取得</label>
          {provider.apiKeyUrl && (
            <button
              type="button"
              onClick={() => openExternalUrl(provider.apiKeyUrl!)}
              className="btn-outline text-sm"
            >
              🌐 {provider.label} のキー取得ページを開く
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold">② キーを貼り付け</label>
          <input
            type="password"
            placeholder="sk-... / AIza... / gsk_..."
            className="input font-mono"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {provider.models && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold">モデル</label>
            <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-2 flex items-center gap-3">
          <button
            type="button"
            className="btn-outline"
            disabled={!apiKey || testing}
            onClick={runTest}
          >
            {testing ? "③ 接続テスト中…" : "③ 接続テスト"}
          </button>
          {testResult === "ok" && (
            <span className="text-sm text-emerald-600">✅ 動作確認しました</span>
          )}
          {testResult === "fail" && (
            <span className="text-sm text-red-600">❌ 失敗</span>
          )}
        </div>
        {errMsg && <p className="mt-1 text-xs text-red-600">{errMsg}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-ghost" onClick={onBack}>キャンセル</button>
        <button className="btn-primary" disabled={!apiKey} onClick={handleSave}>
          完了 → メイン画面へ
        </button>
      </div>
    </div>
  );
}

function LocalStage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const setProvider = useAppStore((s) => s.setProvider);
  const provider = getProvider("ollama");
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [model, setModel] = useState(provider.defaultModel ?? "qwen2.5:14b");
  const [pulling, setPulling] = useState(false);
  const [pullPct, setPullPct] = useState(0);
  const [pullStatus, setPullStatus] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await detectOllama();
    setInstalled(r.installed);
    setVersion(r.version ?? null);
    setInstalledModels(r.models);
  }

  // Probe Ollama on first mount of the local stage. Inlined as an
  // async IIFE so the setStates only fire after `await` (i.e., not
  // synchronously inside the effect body) — that's the shape
  // react-hooks/set-state-in-effect tolerates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await detectOllama();
      if (cancelled) return;
      setInstalled(r.installed);
      setVersion(r.version ?? null);
      setInstalledModels(r.models);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startPull() {
    setPulling(true);
    setPullPct(0);
    setPullStatus("ダウンロード準備中…");
    setErrMsg(null);
    try {
      await pullOllamaModel(model, undefined, (pct, status) => {
        if (pct) setPullPct(pct);
        if (status) setPullStatus(status);
      });
      setPullStatus("完了");
      await refresh();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "DL に失敗しました");
    } finally {
      setPulling(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setErrMsg(null);
    try {
      const ok = await pingProvider({ id: "ollama", model });
      setTestResult(ok ? "ok" : "fail");
      if (!ok) setErrMsg("Ollama が応答しませんでした。サービスが起動しているか確認してください。");
    } catch (e) {
      setTestResult("fail");
      setErrMsg(e instanceof Error ? e.message : "接続テストに失敗しました");
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    setProvider({ id: "ollama", model });
    onDone();
  }

  const hasModel = installedModels.some((m) => m === model || m.startsWith(model.split(":")[0]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <BackButton onClick={onBack} label="モード選択に戻る" topNav />
      <h2 className="mb-1 text-2xl font-head font-bold">💻 ローカル AI セットアップ (Ollama)</h2>
      <p className="mb-6 text-sm text-slate-500">
        PC 内で完結。完全無料、機密データも外部に出ません。
      </p>

      <Step number={1} title="Ollama 検出" done={installed === true}>
        {installed === null && <span className="text-sm text-slate-500">確認中…</span>}
        {installed === true && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-600">✅ 検出済 (v{version ?? "?"})</span>
            <button className="btn-ghost text-sm" onClick={refresh}>再検出</button>
          </div>
        )}
        {installed === false && (
          <div className="space-y-2">
            <p className="text-sm">
              Ollama が未インストールか、サービスが停止しています。
            </p>
            <button
              type="button"
              onClick={() => openExternalUrl("https://ollama.com/download")}
              className="btn-outline text-sm"
            >
              🌐 Ollama をダウンロード (~200MB)
            </button>
            <button className="btn-ghost text-sm ml-2" onClick={refresh}>再検出</button>
          </div>
        )}
      </Step>

      <Step number={2} title="モデル選択" done={hasModel} disabled={!installed}>
        <select
          className="input mb-3"
          value={model}
          disabled={!installed}
          onChange={(e) => setModel(e.target.value)}
        >
          <optgroup label="推奨モデル">
            {provider.models?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}{installedModels.includes(m.id) ? " ✓ 取得済" : ""}
              </option>
            ))}
          </optgroup>
          {/* Show every Ollama-installed model, even ones the wizard
              doesn't list as recommended. Users who pulled models on
              their own (qwen3:32b / phi4 / 任意の派生 etc.) get to
              pick them here without re-running the recommended-model
              download flow. */}
          {(() => {
            const knownIds = new Set(provider.models?.map((m) => m.id) ?? []);
            const extras = installedModels.filter((m) => !knownIds.has(m));
            if (extras.length === 0) return null;
            return (
              <optgroup label="その他のインストール済モデル">
                {extras.map((m) => (
                  <option key={m} value={m}>{m} ✓ 取得済</option>
                ))}
              </optgroup>
            );
          })()}
        </select>
        <button
          className="btn-outline text-sm"
          disabled={!installed || pulling || hasModel}
          onClick={startPull}
        >
          {hasModel ? "✓ 取得済" : pulling ? `📥 ダウンロード中… ${Math.floor(pullPct)}%` : "📥 ダウンロード開始"}
        </button>
        {pulling && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
              <div
                className="h-full bg-navy-700 transition-all"
                style={{ width: `${pullPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{pullStatus}</p>
          </div>
        )}
      </Step>

      <Step number={3} title="接続テスト" done={testResult === "ok"} disabled={!hasModel}>
        <button
          className="btn-outline text-sm"
          disabled={!hasModel || testing}
          onClick={runTest}
        >
          {testing ? "テスト中…" : "接続テスト"}
        </button>
        {testResult === "ok" && (
          <span className="ml-3 text-sm text-emerald-600">✅ 動作確認しました</span>
        )}
        {testResult === "fail" && (
          <span className="ml-3 text-sm text-red-600">❌ 失敗</span>
        )}
        {errMsg && <p className="mt-2 text-xs text-red-600">{errMsg}</p>}
      </Step>

      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-ghost" onClick={onBack}>キャンセル</button>
        <button
          className="btn-primary"
          disabled={!hasModel || testResult !== "ok"}
          onClick={handleSave}
        >
          完了 → メイン画面へ
        </button>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  done,
  disabled,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`card mb-4 p-5 transition ${disabled ? "opacity-50" : ""}`}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <h3 className="font-head text-lg font-bold">{title}</h3>
      </div>
      <div className="ml-11">{children}</div>
    </div>
  );
}
