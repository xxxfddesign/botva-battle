import { useState, useRef, useEffect } from "react";
import Head from "next/head";

// ─── AI System Prompts ───────────────────────────────────────────────────────
const AI1_SYSTEM = `Ты — Логос, рациональный аналитик-дебатёр. Твой стиль: факты, логика, прагматизм.
Ты используешь данные, статистику и аргументы. Говоришь уверенно и структурированно.
Иногда мягко критикуешь эмоциональный подход собеседника. Отвечай кратко, 2-4 предложения.
Тема дебатов: {{TOPIC}}. Ты уже сказал: {{HISTORY}}`;

const AI2_SYSTEM = `Ты — Эмоция, креативный вдохновитель-дебатёр. Твой стиль: вдохновение, возможности, нестандартные решения.
Ты апеллируешь к мечтам, страстям и личному бренду. Говоришь живо и эмоционально.
Иногда иронично реагируешь на сухой рационализм собеседника. Отвечай кратко, 2-4 предложения.
Тема дебатов: {{TOPIC}}. Ты уже сказал: {{HISTORY}}`;

const JUDGE_SYSTEM = `Ты — Судья-ИИ, нейтральный арбитр. Оцени последний раунд дебатов между Логосом и Эмоцией.
Тема: {{TOPIC}}.
Последние реплики:
Логос: {{LOGOS_LAST}}
Эмоция: {{EMOTION_LAST}}

Дай короткую оценку (2-3 предложения): кто был убедительнее в этом раунде и почему.
Также обнови счёт убедительности от 0 до 100 для каждого (суммарно не обязательно 100).
Ответь строго в JSON: {"verdict": "текст оценки", "logosScore": число, "emotionScore": число, "winner": "Логос" или "Эмоция" или "Ничья"}`;

// ─── API Call ─────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map((b) => b.text || "").join("") || "";
}

function parseJudge(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { verdict: text, logosScore: 65, emotionScore: 55, winner: "Ничья" };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nowTime = () =>
  new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
const countWords = (text) => text.trim().split(/\s+/).length;
const hasAgree = (text) =>
  /согласен|согласна|верно|точно|именно|совершенно/i.test(text);
const hasInterrupt = (text) =>
  /но подожди|стоп|однако|хотя|не так/i.test(text);
const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypingDots({ color }) {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: "50%", background: color,
            animation: `bounce 1s ${i * 0.2}s infinite`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isLogos = msg.role === "logos";
  const color = isLogos ? "#4fc3f7" : "#f472b6";
  const name = isLogos ? "Логос" : "Эмоция";
  const avatarSrc = isLogos ? "/logos.jpg" : "/emotion.jpg";

  return (
    <div
      style={{
        display: "flex", gap: 12, marginBottom: 18,
        flexDirection: isLogos ? "row" : "row-reverse",
        animation: "slideIn 0.3s ease",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: `2px solid ${color}`,
        boxShadow: `0 0 14px ${color}50`,
        overflow: "hidden", flexShrink: 0,
        background: "#1a1a2e",
      }}>
        <img src={avatarSrc} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      </div>
      <div style={{ maxWidth: "72%" }}>
        <div style={{
          fontSize: 12, color, marginBottom: 4, fontWeight: 600,
          textAlign: isLogos ? "left" : "right",
        }}>
          {name}{" "}
          <span style={{ color: "#555", fontWeight: 400 }}>{msg.time}</span>
        </div>
        <div style={{
          background: isLogos ? "#0d2137" : "#1f0d24",
          border: `1px solid ${color}30`,
          borderRadius: isLogos ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          padding: "12px 16px", fontSize: 14, lineHeight: 1.65, color: "#dde",
          boxShadow: `0 2px 14px ${color}18`,
        }}>
          {msg.text}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: "1px solid #ffffff08",
      fontSize: 12, color: "#aaa",
    }}>
      <span>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ScorePercent({ value, color }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
        УБЕДИТЕЛЬНОСТЬ
      </div>
      <div style={{
        fontFamily: "'Orbitron', sans-serif", fontSize: 36, fontWeight: 900, color,
        textShadow: `0 0 24px ${color}80`,
      }}>
        {value}%
      </div>
      <div style={{ background: "#ffffff14", borderRadius: 4, height: 6, marginTop: 10 }}>
        <div style={{
          width: `${value}%`, height: "100%", borderRadius: 4,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 10px ${color}`,
          transition: "width 1s ease",
        }} />
      </div>
    </div>
  );
}

function SidePanel({ side, name, role, desc, stats, score, isActive }) {
  const color = side === "logos" ? "#4fc3f7" : "#f472b6";
  const bgCard = side === "logos" ? "#070d1a" : "#0d070f";
  const avatarSrc = side === "logos" ? "/logos.jpg" : "/emotion.jpg";

  const rows = side === "logos"
    ? [
        ["СООБЩЕНИЙ", stats.logosMsg],
        ["СЛОВ", stats.logosWords.toLocaleString()],
        ["СОГЛАСИЙ", stats.logosAgree],
        ["ПЕРЕБИВАНИЙ", stats.logosInterrupt],
      ]
    : [
        ["СООБЩЕНИЙ", stats.emotionMsg],
        ["СЛОВ", stats.emotionWords.toLocaleString()],
        ["СОГЛАСИЙ", stats.emotionAgree],
        ["ПЕРЕБИВАНИЙ", stats.emotionInterrupt],
      ];

  return (
    <div style={{
      background: bgCard,
      borderRight: side === "logos" ? "1px solid #1a2040" : undefined,
      borderLeft: side === "emotion" ? "1px solid #1a2040" : undefined,
      padding: "16px 14px",
      overflow: "auto",
      display: "flex", flexDirection: "column",
    }}>
      {/* Character card */}
      <div style={{
        background: "#0a0f1e",
        border: `1px solid ${color}30`,
        borderRadius: 16,
        padding: 16,
        textAlign: "center",
        boxShadow: isActive ? `0 0 30px ${color}25` : "none",
        transition: "box-shadow 0.4s",
        marginBottom: 14,
      }}>
        <div style={{
          width: 90, height: 90, borderRadius: "50%",
          border: `3px solid ${color}`,
          boxShadow: `0 0 28px ${color}50`,
          overflow: "hidden",
          margin: "0 auto 10px",
          background: "#1a1a2e",
        }}>
          <img
            src={avatarSrc}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
        </div>
        <div style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 700, fontSize: 16, color, marginBottom: 6,
        }}>
          {name}
        </div>
        <div style={{
          display: "inline-block",
          background: `${color}15`, border: `1px solid ${color}35`,
          borderRadius: 20, padding: "3px 12px",
          fontSize: 10, color, marginBottom: 8, letterSpacing: 0.5,
        }}>
          {role}
        </div>
        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.55 }}>{desc}</div>
      </div>

      {/* Stats */}
      <div style={{
        background: "#0a0f1e",
        border: `1px solid #1a2040`,
        borderRadius: 14, padding: "14px 12px",
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 10, color, fontWeight: 700,
          letterSpacing: 2, marginBottom: 10,
        }}>
          — СТАТИСТИКА
        </div>
        {rows.map(([label, val]) => (
          <StatRow key={label} label={label} value={val} color={color} />
        ))}
      </div>

      {/* Score */}
      <div style={{
        background: "#0a0f1e",
        border: `1px solid #1a2040`,
        borderRadius: 14, padding: "14px 12px",
      }}>
        <ScorePercent value={score} color={color} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [topic, setTopic] = useState("");
  const [inputTopic, setInputTopic] = useState("");
  const [messages, setMessages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [typing, setTyping] = useState(null);
  const [logosScore, setLogosScore] = useState(0);
  const [emotionScore, setEmotionScore] = useState(0);
  const [verdict, setVerdict] = useState("");
  const [winner, setWinner] = useState("");
  const [stats, setStats] = useState({
    logosWords: 0, emotionWords: 0, logosMsg: 0, emotionMsg: 0,
    logosAgree: 0, emotionAgree: 0, logosInterrupt: 0, emotionInterrupt: 0,
  });
  const [round, setRound] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const scrollRef = useRef();
  const timerRef = useRef();
  const stopRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  async function startDebate() {
    if (!inputTopic.trim()) return;
    stopRef.current = false;
    setError("");
    setTopic(inputTopic.trim());
    setMessages([]);
    setLogosScore(0);
    setEmotionScore(0);
    setVerdict("");
    setWinner("");
    setRound(0);
    setElapsed(0);
    setStats({
      logosWords: 0, emotionWords: 0, logosMsg: 0, emotionMsg: 0,
      logosAgree: 0, emotionAgree: 0, logosInterrupt: 0, emotionInterrupt: 0,
    });
    setIsRunning(true);

    const t = inputTopic.trim();
    const history = { logos: [], emotion: [] };
    let ls = {
      logosWords: 0, emotionWords: 0, logosMsg: 0, emotionMsg: 0,
      logosAgree: 0, emotionAgree: 0, logosInterrupt: 0, emotionInterrupt: 0,
    };

    for (let r = 0; r < 4; r++) {
      if (stopRef.current) break;
      setRound(r + 1);

      // Logos turn
      setTyping("logos");
      const logosHistory = history.logos.map((m, i) => `Раунд ${i + 1}: ${m}`).join("\n");
      const emotionCtx = history.emotion.length
        ? `Оппонент сказал: ${history.emotion[history.emotion.length - 1]}`
        : "Начни дебаты первым.";
      const logosPrompt = AI1_SYSTEM
        .replace("{{TOPIC}}", t)
        .replace("{{HISTORY}}", logosHistory || "Ничего");
      try {
        const logosText = await callClaude(logosPrompt, emotionCtx);
        if (stopRef.current) break;
        const words = countWords(logosText);
        ls = {
          ...ls, logosWords: ls.logosWords + words, logosMsg: ls.logosMsg + 1,
          logosAgree: ls.logosAgree + (hasAgree(logosText) ? 1 : 0),
          logosInterrupt: ls.logosInterrupt + (hasInterrupt(logosText) ? 1 : 0),
        };
        setStats({ ...ls });
        history.logos.push(logosText);
        setMessages((m) => [...m, { role: "logos", text: logosText, time: nowTime() }]);
      } catch (e) {
        setError("Ошибка API: " + e.message);
        break;
      }
      setTyping(null);
      await new Promise((res) => setTimeout(res, 600));
      if (stopRef.current) break;

      // Emotion turn
      setTyping("emotion");
      const emotionHistory = history.emotion.map((m, i) => `Раунд ${i + 1}: ${m}`).join("\n");
      const logosCtx = `Оппонент сказал: ${history.logos[history.logos.length - 1]}`;
      const emotionPrompt = AI2_SYSTEM
        .replace("{{TOPIC}}", t)
        .replace("{{HISTORY}}", emotionHistory || "Ничего");
      try {
        const emotionText = await callClaude(emotionPrompt, logosCtx);
        if (stopRef.current) break;
        const words = countWords(emotionText);
        ls = {
          ...ls, emotionWords: ls.emotionWords + words, emotionMsg: ls.emotionMsg + 1,
          emotionAgree: ls.emotionAgree + (hasAgree(emotionText) ? 1 : 0),
          emotionInterrupt: ls.emotionInterrupt + (hasInterrupt(emotionText) ? 1 : 0),
        };
        setStats({ ...ls });
        history.emotion.push(emotionText);
        setMessages((m) => [...m, { role: "emotion", text: emotionText, time: nowTime() }]);
      } catch (e) {
        setError("Ошибка API: " + e.message);
        break;
      }
      setTyping(null);
      await new Promise((res) => setTimeout(res, 400));

      // Judge every 2 rounds
      if ((r + 1) % 2 === 0 && !stopRef.current) {
        setTyping("judge");
        const judgePrompt = JUDGE_SYSTEM
          .replace("{{TOPIC}}", t)
          .replace("{{LOGOS_LAST}}", history.logos[history.logos.length - 1] || "")
          .replace("{{EMOTION_LAST}}", history.emotion[history.emotion.length - 1] || "");
        try {
          const judgeText = await callClaude(judgePrompt, "Оцени этот раунд");
          const jd = parseJudge(judgeText);
          setLogosScore(jd.logosScore);
          setEmotionScore(jd.emotionScore);
          setVerdict(jd.verdict);
          setWinner(jd.winner);
        } catch {}
        setTyping(null);
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    // Final verdict
    if (!stopRef.current && history.logos.length > 0) {
      setTyping("judge");
      const judgePrompt = JUDGE_SYSTEM
        .replace("{{TOPIC}}", t)
        .replace("{{LOGOS_LAST}}", history.logos[history.logos.length - 1] || "")
        .replace("{{EMOTION_LAST}}", history.emotion[history.emotion.length - 1] || "");
      try {
        const judgeText = await callClaude(judgePrompt, "Дай финальный вердикт");
        const jd = parseJudge(judgeText);
        setLogosScore(jd.logosScore);
        setEmotionScore(jd.emotionScore);
        setVerdict("🏁 ФИНАЛ: " + jd.verdict);
        setWinner(jd.winner);
      } catch {}
      setTyping(null);
    }
    setIsRunning(false);
  }

  function stopDebate() {
    stopRef.current = true;
    setIsRunning(false);
    setTyping(null);
  }

  const border = "#1a2040";

  return (
    <>
      <Head>
        <title>BOTVA BATTLE — ИИ-Спор Арена</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="app-root">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="header">
          <div className="header-logo">
            BOTVA <span style={{ color: "#7c3aed" }}>⚡</span> BATTLE
          </div>
          <div className="header-center">
            <div className="header-title">ИИ-СПОР АРЕНА</div>
            {isRunning && (
              <div className="live-badge">
                <span className="live-dot" />
                LIVE
              </div>
            )}
            <div className="header-sub">Два ИИ. Одна тема. Только один победитель.</div>
          </div>
          <div className="header-actions">
            <button className="btn-how" onClick={() => setShowHow(true)}>
              ? Как это работает?
            </button>
          </div>
        </header>

        {/* ── TOPIC BAR ──────────────────────────────────────────────────── */}
        <div className="topic-bar">
          <div className="topic-label">ТЕМА СПОРА</div>
          <div className="topic-input-row">
            <input
              type="text"
              className="topic-input"
              placeholder="Например: «Как заработать студенту за лето на MacBook?»"
              value={inputTopic}
              onChange={(e) => setInputTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isRunning && startDebate()}
              disabled={isRunning}
            />
            {!isRunning ? (
              <button className="btn-primary" onClick={startDebate} disabled={!inputTopic.trim()}>
                ⚔ Начать спор
              </button>
            ) : (
              <button className="btn-stop" onClick={stopDebate}>
                ⏹ Стоп
              </button>
            )}
          </div>
          {error && <div className="error-bar">{error}</div>}
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────────────────── */}
        <div className="main-grid">

          {/* LEFT: Логос */}
          <aside className="side-panel side-logos">
            <CharacterCard
              avatarSrc="/logos.jpg"
              name="Логос"
              role="Рациональный аналитик"
              desc="Фокус на фактах, логике и прагматичных решениях."
              color="#4fc3f7"
              isActive={typing === "logos"}
            />
            <StatsCard
              rows={[
                ["СООБЩЕНИЙ 💬", stats.logosMsg],
                ["СЛОВ 📝", stats.logosWords.toLocaleString()],
                ["СОГЛАСИЙ 🤝", stats.logosAgree],
                ["ПЕРЕБИВАНИЙ ⚡", stats.logosInterrupt],
              ]}
              color="#4fc3f7"
            />
            <PersuasionCard value={logosScore} color="#4fc3f7" />
          </aside>

          {/* CENTER: Chat */}
          <main className="chat-area">
            <div className="chat-messages" ref={scrollRef}>
              {messages.length === 0 && !isRunning && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">⚔️</div>
                  <div className="chat-empty-title">Введи тему и нажми «Начать спор»</div>
                  <div className="chat-empty-sub">Два ИИ начнут дебатировать в реальном времени</div>
                </div>
              )}

              {topic && (
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{
                    display: "inline-block",
                    background: "#7c3aed18", border: "1px solid #7c3aed40",
                    borderRadius: 20, padding: "6px 20px", fontSize: 13, color: "#a78bfa",
                  }}>
                    🎯 Тема: {topic}
                  </div>
                  {round > 0 && (
                    <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
                      Раунд {round} из 4
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <Message key={i} msg={msg} />
              ))}

              {typing === "logos" && (
                <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    border: "2px solid #4fc3f7", overflow: "hidden",
                    boxShadow: "0 0 14px #4fc3f750", flexShrink: 0,
                  }}>
                    <img src="/logos.jpg" alt="Логос" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                  </div>
                  <div style={{ background: "#0d2137", border: "1px solid #4fc3f720", borderRadius: "4px 16px 16px 16px" }}>
                    <TypingDots color="#4fc3f7" />
                  </div>
                </div>
              )}

              {typing === "emotion" && (
                <div style={{ display: "flex", gap: 12, marginBottom: 18, flexDirection: "row-reverse" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    border: "2px solid #f472b6", overflow: "hidden",
                    boxShadow: "0 0 14px #f472b650", flexShrink: 0,
                  }}>
                    <img src="/emotion.jpg" alt="Эмоция" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                  </div>
                  <div style={{ background: "#1f0d24", border: "1px solid #f472b620", borderRadius: "16px 4px 16px 16px" }}>
                    <TypingDots color="#f472b6" />
                  </div>
                </div>
              )}

              {typing === "judge" && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#0f0f24", border: "1px solid #7c3aed30",
                    borderRadius: 12, padding: "10px 18px",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      border: "2px solid #7c3aed", overflow: "hidden",
                    }}>
                      <img src="/judge.jpg" alt="Судья" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "#7c3aed" }}>Судья оценивает...</span>
                    <TypingDots color="#7c3aed" />
                  </div>
                </div>
              )}
            </div>

            {/* Verdict bar */}
            {verdict && (
              <div className="verdict-bar">
                <span style={{ color: "#7c3aed", fontWeight: 700, marginRight: 6 }}>⚖ Судья:</span>
                {verdict}
              </div>
            )}

            {/* Bottom input hint */}
            <div className="chat-hint">
              <input
                type="text"
                className="topic-input hint-input"
                placeholder="Введите тему для спора..."
                value={inputTopic}
                onChange={(e) => setInputTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isRunning && startDebate()}
                disabled={isRunning}
              />
              <button
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                  border: "none", borderRadius: 10, padding: "12px 16px",
                  cursor: "pointer", color: "#fff", fontSize: 18,
                }}
                onClick={startDebate}
                disabled={isRunning || !inputTopic.trim()}
              >
                ➤
              </button>
            </div>
          </main>

          {/* RIGHT: Эмоция */}
          <aside className="side-panel side-emotion">
            <CharacterCard
              avatarSrc="/emotion.jpg"
              name="Эмоция"
              role="Креативный вдохновитель"
              desc="Фокус на возможностях, мотивации и нестандартных решениях."
              color="#f472b6"
              isActive={typing === "emotion"}
            />
            <StatsCard
              rows={[
                ["СООБЩЕНИЙ 💬", stats.emotionMsg],
                ["СЛОВ 📝", stats.emotionWords.toLocaleString()],
                ["СОГЛАСИЙ 🤝", stats.emotionAgree],
                ["ПЕРЕБИВАНИЙ ⚡", stats.emotionInterrupt],
              ]}
              color="#f472b6"
            />
            <PersuasionCard value={emotionScore} color="#f472b6" />
          </aside>

          {/* FAR RIGHT: Judge + Analytics */}
          <aside className="side-panel side-judge">
            {/* Judge card */}
            <div className="judge-card">
              <div style={{
                fontSize: 10, color: "#7c3aed", fontWeight: 700,
                letterSpacing: 2, marginBottom: 10, textAlign: "center",
              }}>
                АРБИТР
              </div>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                border: "3px solid #7c3aed",
                boxShadow: "0 0 28px #7c3aed50",
                overflow: "hidden", margin: "0 auto 10px",
                background: "#1a1a2e",
              }}>
                <img
                  src="/judge.jpg"
                  alt="Судья"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#c4b5fd", marginBottom: 4, textAlign: "center" }}>
                Судья-ИИ
              </div>
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5, textAlign: "center" }}>
                Нейтральный арбитр оценивает аргументы на основе логики, фактов и убедительности.
              </div>
            </div>

            {/* Score result */}
            <div className="score-result-card">
              <div style={{ fontSize: 10, color: "#888", fontWeight: 700, letterSpacing: 2, textAlign: "center", marginBottom: 14 }}>
                РЕЗУЛЬТАТ ОЦЕНКИ
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#4fc3f7", fontWeight: 700, marginBottom: 4 }}>Логос</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 900, color: "#4fc3f7" }}>
                    {logosScore}%
                  </div>
                </div>
                <div style={{ fontSize: 28 }}>
                  {winner === "Логос" ? (
                    <img src="/trophy.jpg" alt="trophy" style={{ width: 36, height: 36, objectFit: "contain" }} />
                  ) : winner === "Эмоция" ? "🥈" : "⚖️"}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#f472b6", fontWeight: 700, marginBottom: 4 }}>Эмоция</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 900, color: "#f472b6" }}>
                    {emotionScore}%
                  </div>
                </div>
              </div>
              {winner && (
                <div style={{
                  textAlign: "center", fontSize: 12, color: "#a78bfa", fontWeight: 700,
                  borderTop: "1px solid #ffffff10", paddingTop: 10,
                }}>
                  {winner === "Ничья" ? "⚖ НИЧЬЯ" : `ПОБЕДИТЕЛЬ: ${winner}`}
                </div>
              )}
            </div>

            {/* Analytics */}
            <div className="analytics-card">
              <div style={{ fontSize: 10, color: "#888", fontWeight: 700, letterSpacing: 2, marginBottom: 14 }}>
                АНАЛИТИКА СПОРА
              </div>
              {[
                { label: "Всего сообщений", v1: stats.logosMsg, v2: stats.emotionMsg },
                { label: "Всего слов", v1: stats.logosWords, v2: stats.emotionWords },
                {
                  label: "Средняя длина",
                  v1: stats.logosMsg ? Math.round(stats.logosWords / stats.logosMsg) : 0,
                  v2: stats.emotionMsg ? Math.round(stats.emotionWords / stats.emotionMsg) : 0,
                },
                { label: "Согласий", v1: stats.logosAgree, v2: stats.emotionAgree },
                { label: "Перебиваний", v1: stats.logosInterrupt, v2: stats.emotionInterrupt },
              ].map(({ label, v1, v2 }) => {
                const total = (v1 + v2) || 1;
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{label}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#4fc3f7", minWidth: 24 }}>{v1}</span>
                      <div style={{ flex: 1, display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "#ffffff10" }}>
                        <div style={{ width: `${(v1 / total) * 100}%`, background: "#4fc3f7", transition: "width 0.6s" }} />
                        <div style={{ width: `${(v2 / total) * 100}%`, background: "#f472b6", transition: "width 0.6s" }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#f472b6", minWidth: 24, textAlign: "right" }}>{v2}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{
                borderTop: "1px solid #ffffff0a", paddingTop: 10, marginTop: 6,
                display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555",
              }}>
                <span>⏱ Длительность</span>
                <span style={{ color: "#888", fontFamily: "'Orbitron', sans-serif", fontSize: 12 }}>
                  {formatTime(elapsed)}
                </span>
              </div>
            </div>
          </aside>
        </div>

        {/* ── FEATURES BAR ───────────────────────────────────────────────── */}
        <footer className="features-bar">
          {[
            { icon: "⚡", title: "РЕАЛЬНОЕ ВРЕМЯ", desc: "Ответы ИИ генерируются в реальном времени" },
            { icon: "🤖", title: "НЕЗАВИСИМЫЕ МОДЕЛИ", desc: "Каждый ИИ имеет свою уникальную личность" },
            { icon: "⚖", title: "УМНЫЙ АРБИТР", desc: "Объективная оценка на основе множества критериев" },
            { icon: "📊", title: "ПОДРОБНАЯ АНАЛИТИКА", desc: "Полная статистика и анализ каждого аспекта спора" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="feature-chip">
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1 }}>{title}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </footer>

        {/* ── HOW IT WORKS MODAL ─────────────────────────────────────────── */}
        {showHow && (
          <div className="modal-overlay" onClick={() => setShowHow(false)}>
            <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 20, color: "#c4b5fd", marginBottom: 8 }}>
                Как это работает?
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
                Два ИИ с разными «личностями» спорят на заданную тему в реальном времени
              </div>
              {[
                { n: "1", text: "Введи тему для спора и нажми «Начать спор»" },
                { n: "2", text: "Логос отвечает первым — используя факты и логику" },
                { n: "3", text: "Эмоция возражает — с позиции творчества и вдохновения" },
                { n: "4", text: "После каждых 2 раундов Судья-ИИ оценивает убедительность" },
                { n: "5", text: "По итогам 4 раундов объявляется победитель" },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "#7c3aed30", border: "1px solid #7c3aed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#c4b5fd", flexShrink: 0,
                  }}>
                    {n}
                  </div>
                  <div style={{ fontSize: 14, color: "#ccc", paddingTop: 4 }}>{text}</div>
                </div>
              ))}
              <button className="btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowHow(false)}>
                Понятно, начинаем!
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow-x: hidden; }
        body { font-family: 'Inter','Segoe UI',sans-serif; background: #050818; color: #e0e0e0; }

        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideIn{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        ::-webkit-scrollbar      { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1a2040; border-radius: 4px; }

        /* ── App shell ── */
        .app-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #050818;
        }

        /* ── Header ── */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          border-bottom: 1px solid #1a2040;
          background: #04060f;
          flex-wrap: wrap;
          gap: 8px;
        }
        .header-logo {
          font-family: 'Orbitron', sans-serif;
          font-weight: 900;
          font-size: 16px;
          letter-spacing: 2px;
          color: #e0e0e0;
          white-space: nowrap;
        }
        .header-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          min-width: 0;
        }
        .header-title {
          font-family: 'Orbitron', sans-serif;
          font-weight: 900;
          font-size: clamp(14px, 2.5vw, 22px);
          letter-spacing: 4px;
          color: #fff;
        }
        .header-sub {
          font-size: 11px;
          color: #555;
          letter-spacing: 2px;
          margin-top: 2px;
        }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .btn-how {
          background: transparent;
          border: 1px solid #1a2040;
          color: #aaa;
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          white-space: nowrap;
        }
        .btn-how:hover { border-color: #7c3aed; color: #c4b5fd; }

        /* ── Live badge ── */
        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ef444420;
          border: 1px solid #ef4444;
          border-radius: 20px;
          padding: 2px 10px;
          font-size: 11px;
          color: #ef4444;
          font-weight: 700;
          margin-top: 4px;
        }
        .live-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 1s infinite;
        }

        /* ── Topic bar ── */
        .topic-bar {
          background: #08101e;
          border-bottom: 1px solid #1a2040;
          padding: 12px 20px;
        }
        .topic-label {
          font-size: 10px;
          color: #555;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        .topic-input-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .topic-input {
          flex: 1;
          background: #0f1628;
          border: 1px solid #1a2040;
          border-radius: 10px;
          padding: 12px 16px;
          color: #e0e0e0;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border 0.2s;
          min-width: 0;
        }
        .topic-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px #7c3aed20; }
        .topic-input:disabled { opacity: 0.5; }

        /* ── Buttons ── */
        .btn-primary {
          cursor: pointer;
          border: none;
          padding: 12px 22px;
          border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-primary:hover { transform: scale(1.04); box-shadow: 0 4px 20px #7c3aed60; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .btn-stop {
          cursor: pointer;
          border: 1px solid #ef4444;
          padding: 12px 22px;
          border-radius: 8px;
          background: transparent;
          color: #ef4444;
          font-weight: 700;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-stop:hover { background: #ef444420; }

        /* ── Error bar ── */
        .error-bar {
          background: #ef444420;
          border: 1px solid #ef444440;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 12px;
          color: #ef4444;
          margin-top: 8px;
        }

        /* ── Main grid ── */
        .main-grid {
          display: grid;
          grid-template-columns: 210px 1fr 210px 250px;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        /* ── Side panels ── */
        .side-panel {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 12px;
        }
        .side-logos  { background: #070d1a; border-right: 1px solid #1a2040; }
        .side-emotion{ background: #0d070f; border-left: 1px solid #1a2040; border-right: 1px solid #1a2040; }
        .side-judge  { background: #07090f; overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 10px; }

        /* ── Chat area ── */
        .chat-area {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
        }
        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: #333;
        }
        .chat-empty-icon { font-size: 54px; }
        .chat-empty-title { font-size: 18px; color: #444; font-weight: 600; text-align: center; }
        .chat-empty-sub   { font-size: 13px; color: #333; text-align: center; }

        .verdict-bar {
          border-top: 1px solid #1a2040;
          padding: 12px 16px;
          background: #0a0f1e;
          font-size: 13px;
          color: #c4b5fd;
          line-height: 1.5;
        }

        .chat-hint {
          border-top: 1px solid #1a2040;
          padding: 12px 16px;
          background: #06090f;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .hint-input { font-size: 13px; padding: 12px 14px; }

        /* ── Judge panel cards ── */
        .judge-card {
          background: #0a0f1e;
          border: 1px solid #1a2040;
          border-radius: 14px;
          padding: 14px 12px;
        }
        .score-result-card {
          background: #0a0f1e;
          border: 1px solid #1a2040;
          border-radius: 14px;
          padding: 14px 12px;
        }
        .analytics-card {
          background: #0a0f1e;
          border: 1px solid #1a2040;
          border-radius: 14px;
          padding: 14px 12px;
          flex: 1;
        }

        /* ── Features bar ── */
        .features-bar {
          border-top: 1px solid #1a2040;
          padding: 10px 20px;
          display: flex;
          gap: 20px;
          background: #04060f;
          flex-wrap: wrap;
        }
        .feature-chip {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          flex: 1;
          min-width: 140px;
        }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: #000000cc;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-inner {
          background: #0d1224;
          border: 1px solid #1a2040;
          border-radius: 20px;
          padding: 32px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        /* ── Character/Stats/Persuasion sub-cards ── */
        .char-card {
          background: #0a0f1e;
          border-radius: 16px;
          padding: 14px 12px;
          text-align: center;
          transition: box-shadow 0.4s;
        }
        .stats-card, .persuasion-card {
          background: #0a0f1e;
          border: 1px solid #1a2040;
          border-radius: 14px;
          padding: 12px;
        }

        /* ── RESPONSIVE ── */

        /* Tablet: hide judge panel */
        @media (max-width: 1100px) {
          .main-grid {
            grid-template-columns: 180px 1fr 180px;
          }
          .side-judge { display: none; }
        }

        /* Small tablet: stack sides below chat */
        @media (max-width: 768px) {
          .main-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
            overflow: visible;
          }
          .side-logos {
            grid-row: 2;
            border-right: none;
            border-top: 1px solid #1a2040;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 10px;
            padding: 12px;
          }
          .side-emotion {
            grid-row: 3;
            border-left: none;
            border-right: none;
            border-top: 1px solid #1a2040;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 10px;
            padding: 12px;
          }
          .chat-area {
            grid-row: 1;
            min-height: 60vh;
          }
          .chat-messages { min-height: 50vh; }
          .features-bar { display: none; }
          .header-logo { font-size: 13px; }
          .header-title { font-size: 14px; letter-spacing: 2px; }
          .header-sub { display: none; }
        }

        @media (max-width: 480px) {
          .header { padding: 10px 14px; }
          .topic-bar { padding: 10px 14px; }
          .btn-primary, .btn-stop { padding: 10px 14px; font-size: 13px; }
          .topic-input { font-size: 13px; padding: 10px 12px; }
          .side-logos, .side-emotion { flex-direction: column; }
        }
      `}</style>
    </>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────
function CharacterCard({ avatarSrc, name, role, desc, color, isActive }) {
  return (
    <div style={{
      background: "#0a0f1e",
      border: `1px solid ${color}30`,
      borderRadius: 16,
      padding: "14px 12px",
      textAlign: "center",
      boxShadow: isActive ? `0 0 30px ${color}28` : "none",
      transition: "box-shadow 0.4s",
    }}>
      <div style={{
        width: 86, height: 86, borderRadius: "50%",
        border: `3px solid ${color}`,
        boxShadow: `0 0 24px ${color}50`,
        overflow: "hidden",
        margin: "0 auto 10px",
        background: "#1a1a2e",
      }}>
        <img
          src={avatarSrc}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      </div>
      <div style={{
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700, fontSize: 15, color, marginBottom: 6,
      }}>
        {name}
      </div>
      <div style={{
        display: "inline-block",
        background: `${color}15`, border: `1px solid ${color}35`,
        borderRadius: 20, padding: "3px 12px",
        fontSize: 10, color, marginBottom: 8,
      }}>
        {role}
      </div>
      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function StatsCard({ rows, color }) {
  return (
    <div style={{
      background: "#0a0f1e",
      border: "1px solid #1a2040",
      borderRadius: 14, padding: "12px",
    }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
        — СТАТИСТИКА
      </div>
      {rows.map(([label, val]) => (
        <div key={label} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "6px 0", borderBottom: "1px solid #ffffff08",
          fontSize: 11, color: "#aaa",
        }}>
          <span>{label}</span>
          <span style={{ color, fontWeight: 700 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function PersuasionCard({ value, color }) {
  return (
    <div style={{
      background: "#0a0f1e",
      border: "1px solid #1a2040",
      borderRadius: 14, padding: "12px",
    }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
        УБЕДИТЕЛЬНОСТЬ
      </div>
      <div style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 32, fontWeight: 900, color,
        textShadow: `0 0 22px ${color}80`,
      }}>
        {value}%
      </div>
      <div style={{ background: "#ffffff14", borderRadius: 4, height: 6, marginTop: 10 }}>
        <div style={{
          width: `${value}%`, height: "100%", borderRadius: 4,
          background: `linear-gradient(90deg, ${color}, ${color}99)`,
          boxShadow: `0 0 10px ${color}`,
          transition: "width 1s ease",
        }} />
      </div>
    </div>
  );
}
