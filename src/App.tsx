import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Send,
  Trash2,
  Zap,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader,
} from 'lucide-react';
import './App.css';

const API_URL = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:5001';

interface Message {
  id: number;
  role: 'user' | 'bot';
  text: string;
  time: string;
  isError?: boolean;
}

const SUGGESTIONS = [
  { text: 'How do I get started with Ritinjali?' },
  { text: 'What are the key features of the platform?' },
  { text: 'How does the authentication system work?' },
  { text: 'Where can I find reports and analytics?' },
];

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n/g, '<br/>');
}

const STORAGE_KEY = 'ritinjali_messages';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [sessions, setSessions] = useState([{ id: 'default', label: 'Manual Q&A' }]);
  const [activeSession, setActiveSession] = useState('default');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(r => r.ok ? setApiStatus('online') : setApiStatus('offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const sendMessage = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: Date.now(), role: 'user', text: q, time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot', text: data.answer, time: getTime(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot', isError: true, time: getTime(),
        text: 'Unable to reach the assistant service. Please ensure the API server is running on port 5001.',
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [loading, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const newSession = () => {
    clearChat();
    const id = `s_${Date.now()}`;
    const label = `Session ${sessions.length + 1}`;
    setSessions(prev => [{ id, label }, ...prev]);
    setActiveSession(id);
  };

  const statusIcon = () => {
    if (apiStatus === 'checking') return <Loader size={11} className="icon-spin" />;
    if (apiStatus === 'online')   return <Wifi size={11} />;
    return <WifiOff size={11} />;
  };

  return (
    <div className="app-shell">

      {/* ──── Sidebar ──── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-lockup">
            <div className="logo-mark">
              <BookOpen size={16} strokeWidth={1.8} color="var(--text-inverse)" />
            </div>
            <div className="logo-name">
              <span className="logo-primary">Ritinjali</span>
              <span className="logo-secondary">Knowledge Assistant</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="new-chat-btn" onClick={newSession}>
            <Plus size={14} strokeWidth={2} />
            New conversation
          </button>

          <span className="nav-section-label">History</span>

          {sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeSession ? 'active' : ''}`}
              onClick={() => setActiveSession(s.id)}
            >
              <span className="session-dot" />
              <MessageSquare size={12} strokeWidth={1.5} />
              <span className="session-label">{s.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`api-status ${apiStatus}`}>
            {statusIcon()}
            <span>
              {apiStatus === 'checking' ? 'Connecting' : apiStatus === 'online' ? 'Service online' : 'Service offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* ──── Chat Main ──── */}
      <main className="chat-main">

        {/* Top bar */}
        <header className="topbar">
          <div className="model-pill">
            <Zap size={10} strokeWidth={2.5} />
            Gemini · RAG
          </div>

          <div className="topbar-center">
            <span className="topbar-title">Ritinjali Assistant</span>
            <div className="topbar-divider" />
            <span className="topbar-subtitle">User Manual</span>
          </div>

          <div className="topbar-right">
            <button className="icon-btn" onClick={clearChat} title="Clear conversation">
              <Trash2 size={14} strokeWidth={1.6} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="messages-scroll">
          <div className="messages-inner">
            {messages.length === 0 ? (
              <div className="welcome-wrap">
                <p className="welcome-eyebrow">
                  <BookOpen size={12} strokeWidth={1.8} />
                  Knowledge Assistant
                </p>
                <h1 className="welcome-heading">
                  Ask anything about<br /><em>Ritinjali.</em>
                </h1>
                <p className="welcome-desc">
                  I answer exclusively from the official Ritinjali user manual — no hallucinations, no guesswork. Ask about features, workflows, setup, or troubleshooting.
                </p>
                <div className="suggestion-row">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="suggestion-card" onClick={() => sendMessage(s.text)}>
                      <span className="suggestion-label">{s.text}</span>
                      <span className="suggestion-arrow">
                        <ChevronRight size={13} strokeWidth={2} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} className="msg-group">
                    {msg.role === 'bot' ? (
                      <>
                        <div className="msg-meta">
                          <span className="msg-sender bot">Ritinjali AI</span>
                          <span className="msg-time">{msg.time}</span>
                          {msg.isError && <AlertCircle size={12} strokeWidth={1.8} className="error-icon" />}
                        </div>
                        <div
                          className={`bot-message ${msg.isError ? 'error-msg' : ''}`}
                          dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }}
                        />
                      </>
                    ) : (
                      <>
                        <div className="msg-meta meta-right">
                          <span className="msg-time">{msg.time}</span>
                          <span className="msg-sender user">You</span>
                        </div>
                        <div className="user-msg-wrap">
                          <div className="user-message">{msg.text}</div>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="typing-row">
                    <Loader size={12} strokeWidth={1.8} className="icon-spin muted" />
                    <span className="typing-label">Searching manual</span>
                    <div className="typing-dots">
                      <div className="t-dot" />
                      <div className="t-dot" />
                      <div className="t-dot" />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="input-section">
          <div className="input-inner">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                rows={1}
                disabled={loading}
                placeholder="Ask about Ritinjali..."
                onChange={e => { setInput(e.target.value); autoResize(e.target); }}
                onKeyDown={handleKey}
              />
              <button
                className={`send-btn ${input.trim() && !loading ? 'active' : ''}`}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                aria-label="Send"
              >
                <Send size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="input-hint">
              <span><kbd>Enter</kbd> to send</span>
              <span className="hint-divider">·</span>
              <span><kbd>Shift+Enter</kbd> for new line</span>
              <span className="hint-divider">·</span>
              <span>Answers sourced from the user manual</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
