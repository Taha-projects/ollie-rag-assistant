import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, BookOpen, Check, ChevronRight, Eye, EyeOff, FileText, Globe2, LoaderCircle, LogOut, MessageSquarePlus, Moon, Paperclip, PanelLeftClose, PanelRightClose, PanelRightOpen, Plus, Search, Share2, ShieldCheck, Sparkles, Sun, Trash2, X } from 'lucide-react'

const starter = { role: 'assistant', content: 'Hi! I’m Ollie. Add up to seven PDFs, images, or TXT files and ask questions about them, or turn on AI Think to ask Ollie independently.' }
const gmailEmailPattern = /^[A-Z0-9._%+-]+@gmail\.com$/i
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{10,128}$/
const termsText = [
  ['Using Ollie', 'Ollie is a learning and research assistant. Verify important answers against their cited sources. Do not use it for emergency, legal, medical, or financial decisions.'],
  ['Your account', 'Keep your password private. You are responsible for activity in your account. Ollie limits each account to 100 questions per UTC day.'],
  ['Documents and prompts', 'Uploaded PDFs are processed in memory for the current server session. Their text and your questions are sent to OpenRouter to provide AI features; scanned-page OCR may incur model-provider charges. Do not upload information you are not allowed to share with those services.'],
  ['Privacy and availability', 'Account email, password hash, accepted terms version, sessions, and daily question counts are stored in the local app database. The service is a demo and may be unavailable or changed.'],
  ['Acceptable use', 'Do not use Ollie to break laws, violate others’ rights, attack the service, or upload malicious files. Accounts may be restricted if the service is abused.'],
]

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.')
  return data
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ollie-theme') || localStorage.getItem('atlas-theme') || 'dark')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [docs, setDocs] = useState([])
  const [fileStatus, setFileStatus] = useState(null)
  const [usage, setUsage] = useState({ used: 0, limit: 100, remaining: 100, resets_at: '00:00 UTC' })
  const [messages, setMessages] = useState([starter])
  const [input, setInput] = useState('')
  const [think, setThink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState(['Research chat'])
  const [sidebar, setSidebar] = useState(true)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [printPromptOpen, setPrintPromptOpen] = useState(false)
  const [modal, setModal] = useState('')
  const [tourStep, setTourStep] = useState(0)
  const fileRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ollie-theme', theme)
  }, [theme])

  useEffect(() => {
    api('/api/auth/me').then(async data => {
      if (data.authenticated) await enterApp(data.user, data.usage, false)
    }).catch(() => {}).finally(() => setAuthReady(true))
  }, [])

  async function enterApp(nextUser, nextUsage, fromAuth) {
    setUser(nextUser); setUsage(nextUsage || { used: 0, limit: 100, remaining: 100 })
    try { setDocs(await api('/api/documents')) } catch { setDocs([]) }
    setMessages([starter]); setNotice('')
    if (!nextUser.tutorial_seen && fromAuth) { setTourStep(0); setModal('tutorial') }
  }

  async function submitAuth(event) {
    event.preventDefault(); setAuthNotice('')
    if (!gmailEmailPattern.test(email.trim())) { setAuthNotice('Use a Gmail address ending in @gmail.com.'); return }
    if (authMode === 'signup' && !strongPasswordPattern.test(password)) { setAuthNotice('Password needs 10+ characters, uppercase and lowercase letters, a number, and a special character. They can appear anywhere.'); return }
    setAuthBusy(true)
    try {
      const data = await api(`/api/auth/${authMode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accept_terms: authMode === 'signup' && acceptTerms }),
      })
      await enterApp(data.user, data.usage, true)
    } catch (error) { setAuthNotice(error.message) }
    finally { setAuthBusy(false) }
  }

  async function closeTutorial() {
    setModal('')
    try { await api('/api/auth/tutorial-seen', { method: 'POST' }) } catch {}
    setUser(current => current ? { ...current, tutorial_seen: true } : current)
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch {}
    setUser(null); setDocs([]); setMessages([starter]); setInput(''); setPassword(''); setNotice(''); setHistory(['Research chat'])
  }

  async function refreshUsage() {
    try { setUsage(await api('/api/usage')) } catch {}
  }

  async function upload(files) {
    if (!files?.length) return
    const allowed = [...files].filter(file => /\.(pdf|png|jpe?g|webp|txt)$/i.test(file.name))
    if (allowed.length !== files.length) { setNotice('Supported files: PDF, PNG, JPG, WEBP, and TXT.'); setFileStatus({ kind: 'error', text: 'Some files were skipped. Choose a PDF, image, or TXT file.' }) }
    const space = Math.max(0, 7 - docs.length)
    if (allowed.length > space) { setNotice(`You can add ${space} more file${space === 1 ? '' : 's'} to this chat (seven total).`); setFileStatus({ kind: 'error', text: `The seven-file limit leaves room for ${space} more file${space === 1 ? '' : 's'}.` }) }
    for (const file of allowed.slice(0, space)) {
      const body = new FormData(); body.append('file', file)
      setFileStatus({ kind: 'processing', text: `Processing ${file.name}: extracting text and splitting it into searchable chunks…` })
      try {
        const data = await api('/api/documents', { method: 'POST', body })
        setDocs(previous => [...previous, data]); setNotice(`${file.name} uploaded successfully and is ready to search.`); setFileStatus({ kind: 'success', text: `${file.name} uploaded successfully. Its text is chunked and ready to search.` })
      } catch (error) { setNotice(error.message); setFileStatus({ kind: 'error', text: `Could not process ${file.name}: ${error.message}` }) }
    }
  }

  async function send() {
    const question = input.trim()
    if (!question || busy || !user) return
    if (!usage.remaining) { setNotice(`Today's ${usage.limit}-question limit is reached. It resets at ${usage.resets_at}.`); return }
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next); setInput(''); setBusy(true); setNotice('')
    try {
      const data = await api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, think_mode: think, history: messages.filter(message => message.role !== 'system').slice(-8), document_ids: docs.map(doc => doc.id) }) })
      setMessages([...next, { role: 'assistant', content: data.answer, sources: data.sources || [], webSources: data.web_sources || [] }])
      if (data.usage) setUsage(data.usage); else await refreshUsage()
    } catch (error) { setMessages([...next, { role: 'assistant', content: error.message }]); await refreshUsage() }
    finally { setBusy(false); setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50) }
  }

  async function removeDoc(doc) {
    try { await api(`/api/documents/${doc.id}`, { method: 'DELETE' }); setDocs(current => current.filter(item => item.id !== doc.id)); setNotice(`Removed ${doc.name}.`) }
    catch (error) { setNotice(error.message) }
  }

  function newChat() { setMessages([starter]); setHistory(current => ['New chat', ...current]); setNotice('') }
  const ThemeButton = () => <button className="theme-button" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>

  if (!authReady) return <div className="boot-screen"><div className="brand-mark"><Sparkles size={18}/></div><span>Starting Ollie…</span></div>

  if (!user) return <div className="auth-page">
    <div className="auth-top"><a className="brand auth-brand" href="#"><div className="brand-mark"><Sparkles size={17}/></div><span>ollie</span></a><ThemeButton/></div>
    <main className="auth-card">
      <div className="auth-orb"><Sparkles size={22}/></div><div className="eyebrow"><span className="live-dot"/> PRIVATE AI WORKSPACE</div>
      <h1>{authMode === 'signup' ? 'Create your Ollie account' : 'Welcome back'}</h1>
      <p className="auth-lede">{authMode === 'signup' ? 'A clearer way to explore your documents.' : 'Sign in to continue your research.'}</p>
      <form onSubmit={submitAuth} className="auth-form">
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gmail.com" pattern="[A-Za-z0-9._%+-]+@gmail\.com" title="Use a Gmail address ending in @gmail.com." required maxLength={254}/><small>Gmail addresses only</small></label>
        <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={authMode === 'signup' ? '10+ chars · upper/lower · number · symbol' : 'Enter your password'} pattern={authMode === 'signup' ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{10,128}' : undefined} title={authMode === 'signup' ? 'Use at least 10 characters with uppercase and lowercase letters, a number, and a special character. They can appear anywhere.' : undefined} required minLength={authMode === 'signup' ? 10 : undefined} maxLength={128}/><button className="password-visibility" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>{authMode === 'signup' && <small>At least 10 characters, with uppercase, lowercase, a number, and a symbol. They can appear anywhere.</small>}</label>
        {authMode === 'signup' && <label className="terms-check"><input type="checkbox" checked={acceptTerms} onChange={event => setAcceptTerms(event.target.checked)}/><span>I agree to the <button type="button" className="text-link" onClick={() => setModal('terms')}>Terms</button> and <button type="button" className="text-link" onClick={() => setModal('privacy')}>Privacy Notice</button>.</span></label>}
        {authNotice && <div className="auth-alert">{authNotice}</div>}
        <button className="auth-submit" type="submit" disabled={authBusy || (authMode === 'signup' && !acceptTerms)}>{authBusy ? <LoaderCircle className="spin" size={17}/> : authMode === 'signup' ? 'Create account' : 'Sign in'}<ChevronRight size={17}/></button>
      </form>
      <div className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New to Ollie?'} <button className="text-link" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthNotice('') }}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></div>
    </main>
    {modal && <InfoModal kind={modal} close={() => setModal('')}/>}
  </div>

  const progress = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  return <div className="app-shell" data-theme={theme}>
    {sidebar && <aside className="sidebar">
      <div className="brand sidebar-brand"><div className="brand-mark"><Sparkles size={17}/></div><div className="brand-wordmark"><span>ollie</span><small>RAG Model</small></div><button className="icon-button collapse" onClick={() => setSidebar(false)} aria-label="Hide sidebar"><PanelLeftClose size={17}/></button></div>
      <button className="new-chat" onClick={newChat}><MessageSquarePlus size={17}/> New chat <span>⌘ K</span></button>
      <div className="side-label">YOUR WORKSPACE</div><div className="side-link active"><BookOpen size={16}/> Document assistant</div>
      <div className="side-label recent-label">RECENT</div>{history.slice(0, 5).map((item, i) => <button className="history-item" key={`${item}-${i}`}><MessageSquarePlus size={15}/><span>{item}</span></button>)}
      <div className="sidebar-bottom"><button className="icon-button logout" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={16}/></button><div className="account-summary"><strong>{user.email}</strong><small>{usage.limit} questions/day</small></div></div>
    </aside>}
    <main className="main">
      <header className="topbar">{!sidebar && <button className="icon-button" onClick={() => setSidebar(true)} aria-label="Show sidebar"><PanelLeftClose size={18}/></button>}<div className="top-actions"><button className="export-button" onClick={() => setPrintPromptOpen(true)}><Share2 size={15}/><span>Export PDF</span></button><span className="secure"><ShieldCheck size={14}/> Private workspace</span><ThemeButton/><div className="avatar small">{user.email.slice(0,1).toUpperCase()}</div></div></header>
      <section className={`workspace ${sourcesOpen ? '' : 'sources-collapsed'}`}><div className="chat-column">
        {!messages.some(message => message.role === 'user') && <div className="chat-head"><div><div className="eyebrow"><span className="live-dot"/> AI RESEARCH ASSISTANT</div><h1>What would you like to know?</h1><p>Ask about your PDFs, or turn on AI Think for an independent answer.</p></div></div>}
        <div className="chat-scroll">{messages.map((message, i) => <div className={`message-row ${message.role}`} key={i}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={15}/> : user.email.slice(0,1).toUpperCase()}</div><div className="message-content"><div className="message-name">{message.role === 'assistant' ? 'Ollie' : 'You'}</div><div className="message-text">{renderFormattedText(message.content)}</div>{(message.sources?.length || message.webSources?.length) ? <div className="citations">{message.sources?.map((source, j) => <span className="citation" key={`d${j}`}><FileText size={12}/>{source.document}{source.type === 'pdf' ? ` · p. ${source.page}` : ''}</span>)}{message.webSources?.map((source, j) => <a className="citation web-citation" href={source.url} target="_blank" rel="noreferrer" key={`w${j}`}><Globe2 size={12}/>{source.title || 'Web source'} ↗</a>)}</div> : null}</div></div>)}
          {busy && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={15}/></div><div className="message-content"><div className="message-name">Ollie</div><div className="thinking"><LoaderCircle size={15}/> {think ? 'Thinking independently' : 'Searching your documents'}…</div></div></div>}<div ref={endRef}/></div>
        <div className="composer-wrap">{notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
          <div className={`composer ${think ? 'think-mode' : ''}`}><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder={docs.length ? 'Ask a question about your documents…' : 'Add a PDF, then ask a question…'} rows="1" maxLength={8000}/><div className="composer-actions"><button className={`web-toggle ${think ? 'on' : ''}`} onClick={() => setThink(!think)} title="When on, answers from Ollie’s general knowledge and ignores uploaded PDFs"><Sparkles size={15}/><span>AI Think</span><i className="switch"><b/></i></button><div className="composer-right"><span className="key-hint">Enter to send · Shift + Enter for new line</span><button className="send-button" onClick={send} disabled={!input.trim() || busy || usage.remaining === 0} aria-label="Send message">{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowUp size={18}/>}</button></div></div></div>
          <div className="usage-meter"><div className="usage-copy"><span>Daily questions</span><strong>{usage.used} / {usage.limit} used · {usage.remaining} left</strong></div><div className="usage-track"><div className="usage-fill" style={{ width: `${progress}%` }}/></div></div>
          <div className="disclaimer">Ollie can make mistakes. Check important information against the sources.</div>
        </div>
      </div>
      <aside className={`sources-panel ${sourcesOpen ? '' : 'sources-panel-collapsed'}`}>{sourcesOpen ? <><div className="panel-heading"><div><div className="panel-title">Knowledge base <span>{docs.length}/7</span></div><div className="panel-sub">PDFs, images, and text files</div></div><button className="icon-button panel-collapse" onClick={() => setSourcesOpen(false)} aria-label="Collapse knowledge base" title="Collapse knowledge base"><PanelRightClose size={16}/></button><input ref={fileRef} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain" multiple onChange={event => { upload(event.target.files); event.target.value = '' }}/></div>
        <div className="upload-area" onClick={() => docs.length < 7 && fileRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files) }}><div className="upload-icon"><Paperclip size={17}/></div><strong>{docs.length >= 7 ? 'File limit reached' : 'Drop files here or browse'}</strong><span>PDF · PNG/JPG/WEBP · TXT · up to 7 total</span></div>
        <div className="doc-list">{docs.length === 0 ? <div className="empty-docs"><div className="empty-search"><Search size={17}/></div><strong>Your sources will appear here</strong><span>Add PDFs, images, or TXT files to start asking questions.</span></div> : docs.map(doc => <div className="doc-card" key={doc.id}><div className="pdf-icon"><FileText size={17}/></div><div className="doc-info"><strong title={doc.name}>{doc.name}</strong><span>{doc.type === 'pdf' ? `${doc.pages} pages · PDF` : doc.type === 'image' ? 'Image · text extracted' : 'TXT · text indexed'} <i/> Indexed</span></div><button className="icon-button delete" title="Remove file" onClick={() => removeDoc(doc)}><Trash2 size={15}/></button></div>)}</div>
        <div className={`upload-status ${fileStatus?.kind || ''}`} role="status" aria-live="polite">{fileStatus ? <>{fileStatus.kind === 'processing' ? <LoaderCircle size={14} className="spin"/> : fileStatus.kind === 'success' ? <Check size={14}/> : <X size={14}/>}<span>{fileStatus.text}</span></> : <span>Files are split into searchable chunks after upload.</span>}</div>
        <div className="developer-credit">Made by Taha Asim Khan · <button onClick={() => setModal('terms')}>Terms</button> · <button onClick={() => setModal('privacy')}>Privacy</button></div></> : <button className="sources-reopen" onClick={() => setSourcesOpen(true)} aria-label="Open knowledge base" title="Open knowledge base"><PanelRightOpen size={18}/><span>Files</span></button>}</aside></section>
    </main>
    {modal === 'tutorial' && <Tutorial step={tourStep} setStep={setTourStep} close={closeTutorial}/>}
    {(modal === 'terms' || modal === 'privacy') && <InfoModal kind={modal} close={() => setModal('')}/>}
    {printPromptOpen && <PrintExportModal close={() => setPrintPromptOpen(false)} onPrint={() => { setPrintPromptOpen(false); window.print() }}/>}
  </div>
}

function normalizeMessageText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(normalizeMessageText).filter(Boolean).join('\n')
  if (value && typeof value === 'object') return typeof value.text === 'string' ? value.text : normalizeMessageText(value.content)
  return ''
}

function renderFormattedText(value) {
  return normalizeMessageText(value).split(/(\*\*[\s\S]+?\*\*)/g).map((part, index) => {
    const match = part.match(/^\*\*([\s\S]+)\*\*$/)
    return match ? <strong key={index}>{match[1]}</strong> : part
  })
}

function Tutorial({ step, setStep, close }) {
  const steps = [
    { title: 'Add your source documents', text: 'Upload up to seven PDFs, images, or TXT files total. Ollie extracts text and finds relevant passages for each question.' },
    { title: 'Ask and explore', text: 'Ask naturally. Ollie cites PDF pages. Turn on AI Think to get an independent answer without using your PDFs.' },
    { title: 'Keep track of usage', text: 'Your daily question count appears below the composer. The demo limit refreshes at midnight UTC.' },
  ]
  const current = steps[step]
  return <div className="modal-backdrop"><section className="modal-card tutorial-card"><button className="modal-close" onClick={close} aria-label="Close tutorial"><X size={18}/></button><div className="modal-icon"><Sparkles size={20}/></div><div className="eyebrow">YOUR FIRST VISIT · {step + 1} OF {steps.length}</div><h2>{current.title}</h2><p>{current.text}</p><div className="tour-dots">{steps.map((_, i) => <span className={i === step ? 'active' : ''} key={i}/>)}</div><div className="modal-actions"><button className="subtle-button" onClick={close}>Skip tutorial</button><button className="primary-button" onClick={() => step === steps.length - 1 ? close() : setStep(step + 1)}>{step === steps.length - 1 ? 'Get started' : 'Continue'}<ChevronRight size={16}/></button></div></section></div>
}

function PrintExportModal({ close, onPrint }) {
  return <div className="modal-backdrop"><section className="modal-card print-export-card"><button className="modal-close" onClick={close} aria-label="Close export instructions"><X size={18}/></button><div className="modal-icon"><Share2 size={20}/></div><h2>Save this chat as a PDF</h2><p>Ollie will open your browser’s print window. In the print window, choose <strong>Save as PDF</strong> as the destination, then press <strong>Save</strong> and select where to store the file.</p><div className="modal-actions"><button className="subtle-button" onClick={close}>Cancel</button><button className="primary-button" onClick={onPrint}>Continue to print<ChevronRight size={16}/></button></div></section></div>
}

function InfoModal({ kind, close }) {
  const title = kind === 'terms' ? 'Terms & Conditions' : 'Privacy Notice'
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><section className="modal-card info-card"><button className="modal-close" onClick={close} aria-label="Close"><X size={18}/></button><div className="modal-icon"><ShieldCheck size={20}/></div><h2>{title}</h2>{kind === 'terms' ? <div className="legal-copy">{termsText.map(([heading, text]) => <p key={heading}><strong>{heading}.</strong> {text}</p>)}<p className="legal-date">Demo terms · Updated 5 November 2026</p></div> : <div className="legal-copy"><p><strong>Account security.</strong> Passwords are stored as salted, slow one-way hashes. Your sign-in cookie is HttpOnly and is not readable by page scripts. Passwords are never included in login activity records.</p><p><strong>What is stored.</strong> Ollie stores your email, password hash, accepted terms version, active-session hashes and daily question counts in its account database.</p><p><strong>Login activity.</strong> When Cloudflare logging is configured, Ollie sends your account email, whether you signed in or explicitly signed out, and the UTC event time to the developer’s Cloudflare D1 database. Closing the browser or losing connection does not create an explicit sign-out event.</p><p><strong>Documents.</strong> PDF text and embeddings stay in server memory for this demo session. They are sent to OpenRouter for embeddings, OCR when needed, and answers. Do not upload confidential material unless you have permission to share it with the provider.</p><p><strong>API credentials.</strong> The developer’s OpenRouter key is read only by the backend and is never returned to the browser. If this app is published, configure the key in the host’s secret settings and rotate it if exposed.</p><p className="legal-date">Demo privacy notice · Updated 5 November 2026</p></div>}<div className="modal-actions single"><button className="primary-button" onClick={close}>Close</button></div></section></div>
}
