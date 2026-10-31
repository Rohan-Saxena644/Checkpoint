import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Interaction } from "@checkpoint/core";
import type { Expedition } from "../server/game.js";
import { drawScene } from "./scene.js";
import "./style.css";
type Snapshot = ReturnType<Expedition["snapshot"]>;
const stages = [
  "The approach",
  "The crossing",
  "The outpost",
  "The last beacon",
];
const stageLabels = ["Route", "Supplies", "Final gate"];
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    beacon: (
      <>
        <path d="m12 2 6 10-6 10-6-10Z" />
        <path d="m6 12 6 3 6-3M12 2v13" />
      </>
    ),
    play: <path d="m8 4 13 8-13 8Z" />,
    link: (
      <>
        <path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    signal: (
      <>
        <path d="M4 15a11 11 0 0 1 16 0M7 18a7 7 0 0 1 10 0M1 11a16 16 0 0 1 22 0" />
        <circle cx="12" cy="21" r="1" />
      </>
    ),
    code: (
      <>
        <path d="m7 6-6 6 6 6m10-12 6 6-6 6m-4-16-2 20" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    heart: <path d="M12 21 3 12C-4 3 8-1 12 6c4-7 16-3 9 6Z" />,
    shield: <path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z" />,
    bolt: <path d="m13 1-9 13h7l-1 9 10-14h-7Z" />,
    pause: (
      <>
        <path d="M7 4v16M17 4v16" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M21 3 11 13M10 3H3v18h18v-7" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.beacon}
    </svg>
  );
}
function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout>,
      socket: WebSocket;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
      );
      socket.onopen = () => setOnline(true);
      socket.onmessage = (event) => {
        try {
          setSnapshot(JSON.parse(event.data));
        } catch {
          /* retain last known snapshot */
        }
      };
      socket.onclose = () => {
        setOnline(false);
        if (!disposed) timer = setTimeout(connect, 1200);
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket.close();
    };
  }, []);
  return { snapshot, online };
}
async function api(route: string, body: unknown) {
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
function WindowPanel({
  snapshot,
  large = false,
}: {
  snapshot: Snapshot;
  large?: boolean;
}) {
  const w = snapshot.window,
    active = w && ["open", "paused"].includes(w.phase);
  const kind =
    w?.command === "!route"
      ? "route"
      : w?.command === "!supply"
        ? "supply"
        : "charge";
  return (
    <section
      className={`crew-panel ${large ? "large" : ""}`}
      aria-live="polite"
    >
      <div className="eyebrow">
        <span className={`dot ${active ? "cyan" : ""}`} />
        {active
          ? "CREW WINDOW OPEN"
          : w?.outcome
            ? "CREW DECISION"
            : "AWAITING CHECKPOINT"}
        {active && (
          <b className="countdown">{Math.ceil(w.remainingMs / 1000)}s</b>
        )}
      </div>
      <h2>
        {active
          ? kind === "route"
            ? "Which way, crew?"
            : kind === "supply"
              ? "Pack for the crossing."
              : "Bring the shield online."
          : w?.outcome
            ? `${w.outcome.value === "protected" ? "Protective field online" : w.outcome.value === "unprotected" ? "Crossing grace active" : w.outcome.value === "left" ? "The Shatterpath" : w.outcome.value === "right" ? "The Stillwater" : w.outcome.value === "heal" ? "Healing delivered" : w.outcome.value === "shield" ? "Shield delivered" : "Speed boost delivered"}`
            : "Your crew has a part to play."}
      </h2>
      <p>
        {active
          ? "Enter a command in chat. Every crew member has a say."
          : w?.outcome
            ? `${w.outcome.participants} accepted participants · ${w.outcome.fallback ? "Safe fallback used" : "Outcome applied to the expedition"}`
            : "Reach a beacon to invite chat into your expedition."}
      </p>
      {active && (
        <>
          <div className="choice-list">
            {w.definition.kind === "choice" ? (
              w.definition.options.map((option) => {
                const labels: Record<string, string[]> = {
                  left: ["The Shatterpath", "More hazards · more salvage"],
                  right: ["The Stillwater", "Fewer hazards · limited salvage"],
                  shield: ["Shield charge", "Absorbs one storm strike"],
                  heal: ["Field medicine", "Restores up to 2 health"],
                  boost: ["Trail runners", "+50% speed for 15 seconds"],
                };
                const count = w.counts[option] ?? 0;
                return (
                  <div className="crew-choice" key={option}>
                    <div
                      className="vote-fill"
                      style={{
                        width: `${w.participants ? (count / w.participants) * 100 : 0}%`,
                      }}
                    />
                    <div>
                      <strong>{labels[option][0]}</strong>
                      <small>{labels[option][1]}</small>
                      <code>
                        {w.command} {option}
                      </code>
                    </div>
                    <b>{count}</b>
                  </div>
                );
              })
            ) : (
              <>
                <code className="charge-command">!charge</code>
                <div className="progress">
                  <i
                    style={{
                      width: `${Math.min(100, (w.participants / w.definition.target) * 100)}%`,
                    }}
                  />
                </div>
                <strong>
                  {w.participants} / {w.definition.target} distinct crew members
                </strong>
                <small>
                  Success: 12s protection. Fallback: 3s crossing grace.
                </small>
              </>
            )}
          </div>
          <div className="panel-foot">
            <span>{w.participants} accepted participants</span>
            <span>
              {w.phase === "paused" ? "Timer paused" : "Server timed"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
function App() {
  const { snapshot: s, online } = useSnapshot();
  const route = location.pathname;
  const [authenticated, setAuthenticated] = useState(false),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [easy, setEasy] = useState(true),
    [crew, setCrew] = useState(2),
    [mode, setMode] = useState<"simulator" | "twitch">("simulator"),
    [user, setUser] = useState("ada"),
    [text, setText] = useState("!route left");
  const [help, setHelp] = useState(false),
    [tab, setTab] = useState("expedition");
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef(s);
  current.current = s;
  useEffect(() => {
    if (s && !["ready", "won", "lost"].includes(s.run.status)) {
      setMode(s.mode);
      setCrew(s.run.crew);
      setEasy(s.run.easy);
    }
  }, [s?.mode, s?.run.status, s?.run.crew, s?.run.easy]);
  useEffect(() => {
    void fetch("/api/session")
      .then((r) => r.json())
      .then((v) => setAuthenticated(v.authenticated));
  }, []);
  const control = async (body: unknown) => {
    try {
      setError("");
      return await api("/api/control", body);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (route === "/overlay" || route === "/example") return;
    let frame: number;
    const render = () => {
      const ctx = canvas.current?.getContext("2d");
      if (ctx && current.current)
        drawScene(ctx, current.current.run, performance.now());
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [route]);
  useEffect(() => {
    if (!authenticated || (route !== "/play" && route !== "/")) return;
    const pressed = new Set<string>();
    let previous = "0,0";
    const send = () => {
      const x =
          Number(pressed.has("d") || pressed.has("arrowright")) -
          Number(pressed.has("a") || pressed.has("arrowleft")),
        y =
          Number(pressed.has("s") || pressed.has("arrowdown")) -
          Number(pressed.has("w") || pressed.has("arrowup"));
      if (`${x},${y}` !== previous || x || y) {
        previous = `${x},${y}`;
        void api("/api/control", { type: "move", x, y }).catch(() => {});
      }
    };
    const down = (event: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName))
        return;
      const key = event.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        event.preventDefault();
        pressed.add(key);
        send();
      }
      if (key === "escape") {
        pressed.clear();
        send();
        void api("/api/control", { type: "pause" });
      }
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.key.toLowerCase());
      send();
    };
    const blur = () => {
      pressed.clear();
      send();
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", blur);
    const timer = setInterval(send, 100);
    return () => {
      clearInterval(timer);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("blur", blur);
    };
  }, [authenticated, route]);
  if (route === "/example") return <SignalExample />;
  if (!s)
    return (
      <div className="loading">
        <Icon name="beacon" size={40} />
        <p>Establishing the signal…</p>
      </div>
    );
  if (route === "/overlay")
    return (
      <main className="overlay-view">
        <div className="overlay-brand">
          <Icon name="beacon" /> CHECKPOINT{" "}
          <span>
            {s.mode === "simulator" ? "SIMULATED CREW" : "TWITCH CREW"}
          </span>
        </div>
        <WindowPanel snapshot={s} large />
        <div className="overlay-status">
          {!online
            ? "Server disconnected · state may be stale"
            : s.paused || (!s.connected && !s.offlineContinuation)
              ? "Expedition paused"
              : `${stages[s.run.stage]} · ${s.run.hp} health · ${s.run.message}`}
        </div>
      </main>
    );
  const activeWindow = s.window && ["open", "paused"].includes(s.window.phase),
    ready = ["ready", "won", "lost"].includes(s.run.status);
  const commands =
    s.window?.command === "!supply"
      ? ["!supply shield", "!supply heal", "!supply boost"]
      : s.window?.command === "!charge"
        ? ["!charge"]
        : ["!route left", "!route right"];
  return (
    <div className="app">
      <aside className="rail">
        <a className="rail-logo" href="/play" aria-label="Checkpoint">
          <Icon name="beacon" size={30} />
        </a>
        <a
          className={route !== "/dev" ? "rail-item selected" : "rail-item"}
          href="/play"
          title="Expedition"
        >
          <Icon name="grid" />
        </a>
        <a
          className="rail-item"
          href="/overlay"
          target="_blank"
          title="Broadcast overlay"
        >
          <Icon name="signal" />
        </a>
        <a
          className={route === "/dev" ? "rail-item selected" : "rail-item"}
          href="/dev"
          title="Developer simulator"
        >
          <Icon name="code" />
        </a>
        <span className="rail-bottom">
          CP
          <br />
          <small>01</small>
        </span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a className="wordmark" href="/play">
            checkpoint<span> / </span>
            <small>EXPEDITION CONSOLE</small>
          </a>
          <div className="top-actions">
            <span className="connection">
              <span
                className={`dot ${online && s.connected ? "cyan" : "red"}`}
              />
              {!online
                ? "Server offline"
                : s.mode === "simulator"
                  ? "Simulator mode"
                  : s.transportStatus === "connected"
                    ? "Twitch connected"
                    : "Twitch disconnected"}
            </span>
            <a href="/overlay" target="_blank" className="text-link">
              Open overlay <Icon name="external" size={13} />
            </a>
            <button
              className="avatar"
              onClick={() => setHelp(!help)}
              aria-label="Show controls"
            >
              ?
            </button>
          </div>
        </header>
        <main className="main">
          <div className="page-title">
            <div>
              <div className="eyebrow amber">
                CHECKPOINT SHOWCASE <span className="title-dash" /> EXPEDITION
                001
              </div>
              <h1>
                The Last Beacon<span>.</span>
              </h1>
              <p>Carry the light. Trust your crew. Find your way home.</p>
            </div>
            <button className="secondary" onClick={() => setHelp(!help)}>
              <Icon name="code" size={16} /> How to play
            </button>
          </div>
          {help && (
            <div className="help">
              <strong>You pilot. Chat is the expedition crew.</strong>
              <p>
                Move with WASD or arrow keys. Collect 2 amber fragments in each
                region, then enter the beacon on the right. Yellow rings warn of
                an incoming strike; leave before they turn red. At three
                checkpoints, chat chooses your route, delivers a supply, and
                charges the final protective field. Escape pauses. Easy mode has
                more health, smaller hazards, and faster movement.
              </p>
              <button onClick={() => setHelp(false)}>
                Got it <Icon name="check" size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          <div className="content-grid">
            <div className="main-column">
              <section className="game-card">
                <div className="game-toolbar">
                  <div className="live-tag">
                    <span className="dot amber-dot" />
                    {s.run.status === "ready"
                      ? "EXPEDITION READY"
                      : s.run.status === "won"
                        ? "BEACON RESTORED"
                        : s.run.status === "lost"
                          ? "SIGNAL LOST"
                          : `REGION 0${s.run.stage + 1} / 04`}
                  </div>
                  <div className="game-stats">
                    <span>
                      <Icon name="heart" size={15} />
                      {s.run.hp}
                      <small> / {s.run.maxHp}</small>
                    </span>
                    <span>
                      <Icon name="beacon" size={15} />
                      {s.run.total}
                      <small> fragments</small>
                    </span>
                    <span>
                      {Math.floor(s.run.elapsedMs / 60000)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {Math.floor((s.run.elapsedMs / 1000) % 60)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <div className="canvas-wrap">
                  <canvas
                    ref={canvas}
                    width="1000"
                    height="560"
                    role="img"
                    aria-label={`Expedition map. Courier at ${Math.round(s.run.x)}, ${Math.round(s.run.y)}. ${s.run.collected} fragments in this region.`}
                  />
                  <div className="map-coordinate">
                    N ↑ <span>BEACON VALLEY / SECTOR {s.run.stage + 1}</span>
                  </div>
                  <div className="map-region">
                    {stages[s.run.stage]}
                    <small>
                      {s.run.stage === 1
                        ? s.run.route === "left"
                          ? "THE SHATTERPATH"
                          : "THE STILLWATER"
                        : "THE AMBER EXPEDITION"}
                    </small>
                  </div>
                  {ready && (
                    <div className="game-cover">
                      <div className="cover-emblem">
                        <Icon name="beacon" size={40} />
                      </div>
                      <div className="eyebrow">
                        {s.run.status === "won"
                          ? "EXPEDITION COMPLETE"
                          : s.run.status === "lost"
                            ? "THE LIGHT WILL RETURN"
                            : "A COOPERATIVE EXPEDITION"}
                      </div>
                      <h2>
                        {s.run.status === "won"
                          ? "You brought it home."
                          : s.run.status === "lost"
                            ? "Every light gets another chance."
                            : "One courier. One beacon.\nA whole crew behind you."}
                      </h2>
                      <p>
                        {s.run.status === "ready"
                          ? "An original adventure powered by your community."
                          : s.run.message}
                      </p>
                      <button
                        className="primary"
                        onClick={() => {
                          if (!authenticated) {
                            setError(
                              "Unlock streamer controls with the private code printed in the server terminal.",
                            );
                            document.getElementById("control-code")?.focus();
                          } else
                            void control({ type: "start", easy, crew, mode });
                        }}
                      >
                        <Icon name="play" size={17} />
                        {s.run.status === "ready"
                          ? "Begin expedition"
                          : "Start a new expedition"}
                        <Icon name="arrow" size={17} />
                      </button>
                      <span className="cover-note">
                        {easy ? "EASY MODE" : "STANDARD MODE"} ·{" "}
                        {mode === "simulator"
                          ? "SIMULATED CREW"
                          : "LIVE TWITCH"}{" "}
                        · 3 CREW CHECKPOINTS
                      </span>
                    </div>
                  )}
                  {!ready &&
                    (s.paused ||
                      (!s.connected && !s.offlineContinuation) ||
                      !online) && (
                      <div className="pause-cover">
                        <Icon name="pause" size={36} />
                        <h2>Holding the signal.</h2>
                        <p>
                          {!online
                            ? "Server disconnected. Controls are unavailable."
                            : !s.connected
                              ? "Crew transport disconnected. Window and game are paused."
                              : "Emergency pause. Your remaining window time is preserved."}
                        </p>
                        {authenticated &&
                          (s.connected || s.offlineContinuation) &&
                          online && (
                            <button
                              className="primary"
                              onClick={() => void control({ type: "resume" })}
                            >
                              Resume expedition
                            </button>
                          )}
                      </div>
                    )}
                  {!ready &&
                    activeWindow &&
                    !s.paused &&
                    s.connected &&
                    online && (
                      <div className="checkpoint-banner">
                        <Icon name="signal" size={30} />
                        <span>
                          <small>CHECKPOINT REACHED</small>
                          <strong>
                            {s.window?.command === "!route"
                              ? "Let the crew choose the path."
                              : s.window?.command === "!supply"
                                ? "A little help for the road ahead."
                                : "Crew, light up the final gate."}
                          </strong>
                          <code>{commands.join("  ·  ")}</code>
                          <small>
                            {s.window?.participants ?? 0} accepted participants
                            ·{" "}
                            {s.mode === "simulator"
                              ? "SIMULATED CREW"
                              : "TWITCH CREW"}
                          </small>
                        </span>
                        <b>{Math.ceil((s.window?.remainingMs ?? 0) / 1000)}s</b>
                      </div>
                    )}
                  <div className="map-legend">
                    <span>
                      <i className="legend-fragment" /> Fragment
                    </span>
                    <span>
                      <i className="legend-hazard" /> Storm warning
                    </span>
                    <span>
                      <i className="legend-gate" /> Checkpoint
                    </span>
                  </div>
                </div>
                <div className="game-bottom">
                  <span>
                    <i className="mini-beacon" />
                    {s.run.message}
                  </span>
                  <span className="keys">
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd>
                    <small>to move</small>
                  </span>
                </div>
              </section>
              <section className="journey">
                <div className="section-caption">
                  THE EXPEDITION <span>Three moments. A shared story.</span>
                </div>
                <div className="journey-items">
                  {stageLabels.map((label, i) => (
                    <div
                      key={label}
                      className={`journey-step ${s.run.stage > i ? "complete" : s.run.stage === i ? "current" : ""}`}
                    >
                      <span className="step-number">
                        {s.run.stage > i ? (
                          <Icon name="check" size={16} />
                        ) : (
                          `0${i + 1}`
                        )}
                      </span>
                      <div>
                        <strong>{label}</strong>
                        <small>
                          {
                            [
                              "Choose the way forward",
                              "Send something useful",
                              "Power the protective field",
                            ][i]
                          }
                        </small>
                      </div>
                      {i < 2 && <span className="journey-line" />}
                    </div>
                  ))}
                </div>
              </section>
              <div className="lower-grid">
                <WindowPanel snapshot={s} />
                <section className="loadout">
                  <div className="eyebrow">COURIER LOADOUT</div>
                  <h2>A little light goes a long way.</h2>
                  <div className="loadout-item">
                    <span className="item-icon">
                      <Icon name="shield" />
                    </span>
                    <div>
                      <strong>
                        {s.run.shield
                          ? "Shield charged"
                          : s.run.fieldMs > 0
                            ? "Protective field"
                            : "Beacon carrier"}
                      </strong>
                      <small>
                        {s.run.shield
                          ? "Absorbs the next strike"
                          : s.run.fieldMs > 0
                            ? `${Math.ceil(s.run.fieldMs / 1000)}s protection remaining`
                            : "Collect fragments to reach each checkpoint"}
                      </small>
                    </div>
                    <span className="item-status">
                      {s.run.shield || s.run.fieldMs > 0
                        ? "ACTIVE"
                        : "EQUIPPED"}
                    </span>
                  </div>
                  <div className="loadout-item">
                    <span className="item-icon">
                      <Icon name="bolt" />
                    </span>
                    <div>
                      <strong>
                        {s.run.boostMs > 0
                          ? "Trail runners active"
                          : s.run.route === "pending"
                            ? "Route uncharted"
                            : s.run.route === "left"
                              ? "The Shatterpath"
                              : "The Stillwater"}
                      </strong>
                      <small>
                        {s.run.boostMs > 0
                          ? `${Math.ceil(s.run.boostMs / 1000)}s at +50% speed`
                          : s.run.route === "pending"
                            ? "Your crew will choose at checkpoint 01"
                            : s.run.route === "left"
                              ? "6 hazards · 4 salvage opportunities"
                              : "2 hazards · 2 salvage opportunities"}
                      </small>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <aside className="control-column">
              <section className="control-card">
                <div className="control-heading">
                  <Icon name="grid" size={17} />
                  <strong>Expedition control</strong>
                  <span className={`dot ${authenticated ? "cyan" : ""}`} />
                </div>
                <div className="control-tabs">
                  <button
                    className={tab === "expedition" ? "active" : ""}
                    onClick={() => setTab("expedition")}
                  >
                    Setup
                  </button>
                  <button
                    className={tab === "crew" ? "active" : ""}
                    onClick={() => setTab("crew")}
                  >
                    Crew signal
                  </button>
                </div>
                {!authenticated && (
                  <form
                    className="unlock"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void api("/api/login", { code })
                        .then(() => {
                          setAuthenticated(true);
                          setCode("");
                          setError("");
                        })
                        .catch((e) => setError(e.message));
                    }}
                  >
                    <label htmlFor="control-code">
                      Unlock streamer controls
                    </label>
                    <p>Enter the private code from your server terminal.</p>
                    <input
                      id="control-code"
                      type="password"
                      autoComplete="off"
                      placeholder="Private control code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <button className="secondary full" type="submit">
                      Unlock console <Icon name="arrow" size={15} />
                    </button>
                  </form>
                )}
                {tab === "expedition" ? (
                  <div className="setup">
                    <label>CREW CONNECTION</label>
                    <div className="segmented">
                      <button
                        disabled={!ready}
                        className={mode === "simulator" ? "active" : ""}
                        onClick={() => setMode("simulator")}
                      >
                        Simulator
                      </button>
                      <button
                        disabled={!ready}
                        className={mode === "twitch" ? "active" : ""}
                        onClick={() => setMode("twitch")}
                      >
                        Twitch
                      </button>
                    </div>
                    <p className="field-note">
                      {mode === "simulator"
                        ? "Synthetic viewers. Real game consequences."
                        : "Your channel. Ordinary chat commands."}
                    </p>
                    {mode === "twitch" && (
                      <button
                        className="twitch-button full"
                        disabled={!authenticated || !ready}
                        onClick={() => {
                          void api("/api/control/twitch", {})
                            .then((data) => {
                              location.href = data.url;
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        <Icon name="link" size={15} />
                        Authorize broadcaster
                      </button>
                    )}
                    <label htmlFor="crew-size">CREW SIZE PRESET</label>
                    <select
                      id="crew-size"
                      disabled={!ready}
                      value={crew}
                      onChange={(e) => setCrew(Number(e.target.value))}
                    >
                      <option value={1}>Solo signal · 1 participant</option>
                      <option value={2}>Small crew · 2 participants</option>
                      <option value={5}>Expedition · 5 participants</option>
                      <option value={10}>Full crew · 10 participants</option>
                    </select>
                    <p className="field-note">
                      An explicit goal, never an estimated viewer count.
                    </p>
                    <div className="easy-setting">
                      <div>
                        <strong>Easy expedition</strong>
                        <small>A quicker, more forgiving journey</small>
                      </div>
                      <button
                        className={`switch ${easy ? "on" : ""}`}
                        role="switch"
                        aria-checked={easy}
                        aria-label="Easy expedition"
                        disabled={!ready}
                        onClick={() => setEasy(!easy)}
                      >
                        <i />
                      </button>
                    </div>
                    <div className="control-divider" />
                    <button
                      className="secondary full"
                      disabled={!authenticated || ready}
                      onClick={() =>
                        void control({ type: s.paused ? "resume" : "pause" })
                      }
                    >
                      <Icon name={s.paused ? "play" : "pause"} size={16} />
                      {s.paused ? "Resume expedition" : "Pause expedition"}
                      <kbd>ESC</kbd>
                    </button>
                    <button
                      className="danger full"
                      disabled={!authenticated || ready}
                      onClick={() => void control({ type: "pause" })}
                    >
                      Emergency stop
                    </button>
                    <p className="field-note centered">
                      You always stay in control.
                    </p>
                  </div>
                ) : (
                  <div className="setup">
                    <div className="eyebrow cyan-text">{s.transportStatus}</div>
                    <p className="field-note">
                      The server owns accepted participation and the clock.
                      Disconnection freezes both.
                    </p>
                    <button
                      className="secondary full"
                      disabled={
                        !authenticated ||
                        !activeWindow ||
                        !s.connected ||
                        s.paused
                      }
                      onClick={() => void control({ type: "resolve" })}
                    >
                      Resolve crew window
                    </button>
                    <button
                      className="secondary full"
                      disabled={!authenticated || !activeWindow}
                      onClick={() => void control({ type: "fallback" })}
                    >
                      Cancel & use fair fallback
                    </button>
                    <p className="field-note">
                      Fallbacks: safe route, +2 healing, 3s gate grace. No
                      audience required.
                    </p>
                    {s.mode === "twitch" && !s.connected && (
                      <button
                        className="twitch-button full"
                        disabled={!authenticated}
                        onClick={() => {
                          void api("/api/control/twitch", {})
                            .then((data) => {
                              location.href = data.url;
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Reconnect broadcaster
                      </button>
                    )}
                    <button
                      className="danger full"
                      disabled={!authenticated || ready}
                      onClick={() => void control({ type: "pause" })}
                    >
                      Emergency stop
                    </button>
                    {authenticated && (
                      <button
                        className="text-button"
                        onClick={() => {
                          void control({ type: "logout" }).then(() =>
                            setAuthenticated(false),
                          );
                        }}
                      >
                        Lock streamer controls
                      </button>
                    )}
                  </div>
                )}
              </section>
              <section className="sim-card">
                <div className="eyebrow">
                  <span className="dot cyan" />
                  DEVELOPMENT SIMULATOR
                </div>
                <h3>Be your own crew.</h3>
                <p>
                  Try a crew command at a checkpoint. Synthetic participation is
                  always labeled.
                </p>
                <label htmlFor="synthetic-viewer">SYNTHETIC VIEWER</label>
                <select
                  id="synthetic-viewer"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                >
                  {["ada", "moss", "nova", "sol"].map((v) => (
                    <option key={v} value={v}>
                      sim / {v}
                    </option>
                  ))}
                </select>
                <div className="sim-commands">
                  {commands.map((command) => (
                    <button
                      key={command}
                      disabled={
                        !authenticated ||
                        s.mode !== "simulator" ||
                        !activeWindow
                      }
                      onClick={() => {
                        setText(command);
                        void control({
                          type: "sim-input",
                          text: command,
                          user,
                          scenario: "normal",
                        });
                      }}
                    >
                      {command}
                      <Icon name="arrow" size={14} />
                    </button>
                  ))}
                </div>
                <a href="/dev" className="text-link">
                  Open simulator & inspector <Icon name="external" size={13} />
                </a>
              </section>
              <section className="sdk-note">
                <Icon name="code" size={19} />
                <div>
                  <strong>Built on Checkpoint SDK</strong>
                  <p>
                    Game-defined windows.
                    <br />
                    Predictable outcomes.
                  </p>
                  <a href="/example">
                    Explore a tiny integration <span>↗</span>
                  </a>
                </div>
              </section>
            </aside>
          </div>
          {route === "/dev" && (
            <section className="dev-panel">
              <div className="eyebrow amber">
                SIMULATED CONDITIONS · NEVER LIVE TWITCH ACTIVITY
              </div>
              <h2>Signal laboratory</h2>
              <p>
                Uses the same normalized SDK input path. Live chat text and user
                identities are never included in this inspector.
              </p>
              <div className="dev-controls">
                <input
                  aria-label="Synthetic command"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                {(["normal", "duplicate", "stale", "old-window"] as const).map(
                  (scenario) => (
                    <button
                      disabled={!authenticated || s.mode !== "simulator"}
                      key={scenario}
                      className="secondary"
                      onClick={() =>
                        void control({
                          type: "sim-input",
                          text,
                          user,
                          scenario,
                        })
                      }
                    >
                      {scenario}
                    </button>
                  ),
                )}
                {(
                  ["sim-disconnect", "sim-resume", "duplicate-outcome"] as const
                ).map((type) => (
                  <button
                    disabled={!authenticated || s.mode !== "simulator"}
                    key={type}
                    className="secondary"
                    onClick={() => void control({ type })}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <p className="field-note">
                Duplicate: press twice to resend the same delivery ID. Repeat
                normal commands as one user to test replacement or
                one-contribution limits. Stale sends a 30-second-old timestamp.
              </p>
              <div className="inspector">
                <pre>
                  {JSON.stringify(
                    {
                      window: s.window,
                      phase: s.run.status,
                      stage: s.run.stage,
                      transport: s.transportStatus,
                    },
                    null,
                    2,
                  )}
                </pre>
                <div>
                  {s.events.map((event, i) => (
                    <div className="event-row" key={`${event.time}-${i}`}>
                      <time>{new Date(event.time).toLocaleTimeString()}</time>
                      <code>{event.type}</code>
                      <span>{event.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          <footer>
            <span>
              <Icon name="beacon" size={15} /> Give chat a role. Keep the game
              in control.
            </span>
            <span>
              CHECKPOINT SDK <i /> CODEX × TWITCHCON 2026
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function SignalExample() {
  const engine = useRef(new Interaction());
  const [state, setState] = useState(engine.current.snapshot());
  const [signal, setSignal] = useState("amber");
  useEffect(() => {
    const off = engine.current.subscribe((event) => {
      setState(event.state);
      if (event.type === "resolved") setSignal(event.state.outcome!.value);
    });
    const tick = setInterval(() => engine.current.tick(), 100);
    return () => {
      off();
      clearInterval(tick);
    };
  }, []);
  return (
    <main className="example">
      <a href="/play" className="text-link">
        ← Back to the expedition
      </a>
      <div className="eyebrow">
        SECOND INTEGRATION · BROWSER ONLY · SYNTHETIC INPUT
      </div>
      <h1>A tiny signal panel.</h1>
      <p>The same pure SDK, without the game or Twitch adapter.</p>
      <div className={`signal-lamp ${signal}`} />
      <div className="dev-controls">
        <button
          className="primary"
          onClick={() =>
            engine.current.open(
              crypto.randomUUID(),
              {
                kind: "choice",
                options: ["amber", "cyan"],
                fallback: "amber",
              },
              10000,
            )
          }
          disabled={state?.phase === "open"}
        >
          Open a 10s choice
        </button>
        {["amber", "cyan"].map((value) => (
          <button
            className="secondary"
            disabled={state?.phase !== "open"}
            key={value}
            onClick={() =>
              engine.current.accept({
                windowId: state!.id,
                participantId: "local-participant",
                inputId: crypto.randomUUID(),
                sentAt: Date.now(),
                action: value,
              })
            }
          >
            Vote {value}
          </button>
        ))}
        <button className="secondary" onClick={() => engine.current.resolve()}>
          Resolve
        </button>
      </div>
      <pre>{JSON.stringify(state, null, 2) ?? "No window opened yet."}</pre>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
