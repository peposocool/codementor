'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Code2,
  Copy,
  FileCode2,
  FlaskConical,
  GitBranch,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  TerminalSquare,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
} from 'lucide-react'

type Language = 'javascript' | 'typescript' | 'python'
type Preset = 'logic' | 'syntax' | 'recursion'
type Finding = { line: number; title: string; explanation: string; fix: string }
type TestCase = { name: string; input: string; expected: string }
type Diagnosis = {
  summary: string
  severity: 'low' | 'medium' | 'high'
  findings: Finding[]
  reasoning: string[]
  fixedCode: string
  tests: TestCase[]
  parser: { supported: boolean; errors: { line: number; message: string }[] }
  latencyMs: number
}

type Vulnerability = {
  line: number
  type: string
  cwe: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  remediation: string
}
type SecurityCheckItem = { item: string; passed: boolean }
type SecurityReview = {
  overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical'
  summary: string
  vulnerabilities: Vulnerability[]
  secureVersion: string
  checklist: SecurityCheckItem[]
  latencyMs: number
}

const snippets: Record<Preset, Record<Language, string>> = {
  logic: {
    javascript: `function calculateDiscount(price, discountPercent) {\n  const discount = price * discountPercent;\n  return price - discount;\n}\n\nconsole.log(calculateDiscount(100, 20)); // expected: 80`,
    typescript: `function calculateDiscount(price: number, discountPercent: number): number {\n  const discount = price * discountPercent;\n  return price - discount;\n}\n\nconsole.log(calculateDiscount(100, 20)); // expected: 80`,
    python: `def calculate_discount(price, discount_percent):\n    discount = price * discount_percent\n    return price - discount\n\nprint(calculate_discount(100, 20))  # expected: 80`,
  },
  syntax: {
    javascript: `function greet(name) {\n  if (name.length > 0) {\n    return \`Hello, \${name}!\`;\n  else {\n    return "Hello, stranger!";\n  }\n}\n\nconsole.log(greet("Ada"));`,
    typescript: `function greet(name: string): string {\n  if (name.length > 0) {\n    return \`Hello, \${name}!\`;\n  else {\n    return "Hello, stranger!";\n  }\n}\n\nconsole.log(greet("Ada"));`,
    python: `def greet(name):\n    if len(name) > 0:\n        return f"Hello, {name}!"\n    else\n        return "Hello, stranger!"\n\nprint(greet("Ada"))`,
  },
  recursion: {
    javascript: `function factorial(n) {\n  if (n === 0) return 1;\n  return n * factorial(n);\n}\n\nconsole.log(factorial(5));`,
    typescript: `function factorial(n: number): number {\n  if (n === 0) return 1;\n  return n * factorial(n);\n}\n\nconsole.log(factorial(5));`,
    python: `def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n)\n\nprint(factorial(5))`,
  },
}

const initialDiagnosis: Diagnosis = {
  summary: 'The discount is treated as a whole number instead of a percentage.',
  severity: 'medium',
  findings: [{
    line: 2,
    title: 'Percentage is not converted to a decimal',
    explanation: 'Multiplying 100 by 20 produces 2,000. A percentage needs to be divided by 100 before it is applied to the price.',
    fix: 'Divide discountPercent by 100 before multiplying it by price.',
  }],
  reasoning: [
    'Trace the sample call: calculateDiscount(100, 20).',
    'The discount expression evaluates to 100 × 20 = 2,000, not 20.',
    'Subtracting 2,000 from 100 returns −1,900. Convert 20% to 0.2 first.',
  ],
  fixedCode: `function calculateDiscount(price, discountPercent) {\n  const discount = price * (discountPercent / 100);\n  return price - discount;\n}\n\nconsole.log(calculateDiscount(100, 20)); // expected: 80`,
  tests: [
    { name: '20% off $100', input: 'calculateDiscount(100, 20)', expected: '80' },
    { name: '0% discount', input: 'calculateDiscount(80, 0)', expected: '80' },
    { name: 'Full discount', input: 'calculateDiscount(50, 100)', expected: '0' },
  ],
  parser: { supported: true, errors: [] },
  latencyMs: 428,
}

const presetLabels: Record<Preset, string> = {
  logic: 'Logic error',
  syntax: 'Syntax error',
  recursion: 'Infinite recursion',
}

function createUnanalyzedDiagnosis(code: string, language: Language): Diagnosis {
  return {
    summary: 'Run the analysis to get a diagnosis for this code.',
    severity: 'low',
    findings: [],
    reasoning: ['This snippet has not been analyzed yet.'],
    fixedCode: code,
    tests: [],
    parser: { supported: language !== 'python', errors: [] },
    latencyMs: 0,
  }
}

function CodeBlock({ code, highlightLine }: { code: string; highlightLine?: number }) {
  const lines = code.split('\n')
  return (
    <pre className="code-block" aria-label="Corrected code">
      <code>
        {lines.map((line, index) => (
          <span className={`code-row${highlightLine === index + 1 ? ' code-row-highlight' : ''}`} key={`${index}-${line}`}>
            <span className="code-line-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="code-line-content">{line || ' '}</span>
          </span>
        ))}
      </code>
    </pre>
  )
}

export function BugLab() {
  const [preset, setPreset] = useState<Preset>('logic')
  const [language, setLanguage] = useState<Language>('javascript')
  const [source, setSource] = useState(snippets.logic.javascript)
  const [diagnosis, setDiagnosis] = useState<Diagnosis>(initialDiagnosis)
  const [activeTab, setActiveTab] = useState<'patch' | 'tests'>('patch')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [verification, setVerification] = useState<'idle' | 'passed' | 'failed'>('idle')

  // Sentinel — Security Review agent
  const [securityReview, setSecurityReview] = useState<SecurityReview | null>(null)
  const [securityBusy, setSecurityBusy] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securityTab, setSecurityTab] = useState<'vulns' | 'secure' | 'checklist'>('vulns')
  const [secCopied, setSecCopied] = useState(false)
  const lines = useMemo(() => source.split('\n'), [source])
  const highlightLine = diagnosis.findings[0]?.line

  function changePreset(next: Preset) {
    const nextCode = snippets[next][language]
    setPreset(next)
    setSource(nextCode)
    setDiagnosis(createUnanalyzedDiagnosis(nextCode, language))
    setError('')
    setVerification('idle')
  }

  function changeLanguage(next: Language) {
    const nextCode = snippets[preset][next]
    setLanguage(next)
    setSource(nextCode)
    setDiagnosis(createUnanalyzedDiagnosis(nextCode, next))
    setError('')
    setVerification('idle')
  }

  function updateSource(nextCode: string) {
    setSource(nextCode)
    setDiagnosis(createUnanalyzedDiagnosis(nextCode, language))
    setError('')
    setVerification('idle')
    setSecurityReview(null)
    setSecurityError('')
  }

  function downloadPatch() {
    const blob = new Blob([diagnosis.fixedCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `fixed.${language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js'}`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function analyze() {
    setBusy(true)
    setError('')
    setVerification('idle')
    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, language }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The diagnosis could not be completed.')
      setDiagnosis(payload as Diagnosis)
      setActiveTab('patch')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The diagnosis could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function runSecurityReview() {
    setSecurityBusy(true)
    setSecurityError('')
    try {
      const response = await fetch('/api/security-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, language }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Security review could not be completed.')
      setSecurityReview(payload as SecurityReview)
      setSecurityTab('vulns')
    } catch (caught) {
      setSecurityError(caught instanceof Error ? caught.message : 'Security review could not be completed.')
    } finally {
      setSecurityBusy(false)
    }
  }

  async function copySecureCode() {
    if (!securityReview) return
    try {
      await navigator.clipboard.writeText(securityReview.secureVersion)
      setSecCopied(true)
      window.setTimeout(() => setSecCopied(false), 1800)
    } catch {
      setSecurityError('Clipboard access is unavailable in this browser.')
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(diagnosis.fixedCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard access is unavailable in this browser.')
    }
  }

  function runStaticChecks() {
    const code = diagnosis.fixedCode.trim()
    const changed = code.length > 0 && code !== source.trim()
    const bracketsMatch = checkBalancedDelimiters(code)
    setVerification(changed && bracketsMatch ? 'passed' : 'failed')
  }

  return (
    <main className="workbench-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Patchwork home">
          <span className="brand-mark"><Code2 aria-hidden="true" /></span>
          <span>patchwork<span className="brand-period">.</span></span>
          <span className="brand-divider" />
          <span className="brand-subtitle">debugging workspace</span>
        </a>
        <div className="topbar-right">
          <span className="model-chip"><span className="status-dot" /> Gemini 3.8 Flash</span>
          <span className="topbar-divider" />
          <span className="avatar-button" role="img" aria-label="Jordan Doe">JD</span>
        </div>
      </header>

      <div className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-rule" /> CODE REVIEW / SESSION 04</div>
            <h1>Find the bug.<br /><span>Understand the fix.</span></h1>
            <p className="heading-copy">A thoughtful second pair of eyes for the bugs that keep you up.</p>
          </div>
          <div className="session-note"><span className="session-note-icon"><Activity aria-hidden="true" /></span><span><strong>Session is live</strong><small>Changes stay in this workspace</small></span></div>
        </div>

        <section className="metrics-strip" aria-label="System status">
          <div className="metric-cell"><span className="metric-icon green"><span className="status-dot" /></span><span className="metric-label">MODEL</span><strong>Ready</strong></div>
          <div className="metric-cell"><span className="metric-icon blue"><GitBranch aria-hidden="true" /></span><span className="metric-label">AST PARSER</span><strong>{diagnosis.parser.supported ? 'Connected' : 'Language fallback'}</strong></div>
          <div className="metric-cell"><span className="metric-icon violet"><Clock3 aria-hidden="true" /></span><span className="metric-label">LAST RESPONSE</span><strong>{diagnosis.latencyMs ? <>{diagnosis.latencyMs} <small>ms</small></> : '—'}</strong></div>
          <div className="metric-cell metric-feedback"><span className="metric-icon amber"><Sparkles aria-hidden="true" /></span><span className="metric-label">WAS THIS HELPFUL?</span><div className="feedback-actions"><button aria-label="Helpful diagnosis" className={feedback === 'up' ? 'feedback-selected' : ''} onClick={() => setFeedback('up')}><ThumbsUp aria-hidden="true" /></button><button aria-label="Not helpful" className={feedback === 'down' ? 'feedback-selected' : ''} onClick={() => setFeedback('down')}><ThumbsDown aria-hidden="true" /></button></div></div>
        </section>

        <div className="workspace-grid">
          <section className="editor-panel panel" aria-labelledby="editor-title">
            <div className="panel-heading editor-heading">
              <div className="panel-title-group"><span className="panel-index">01</span><div><h2 id="editor-title">Your code</h2><p>Start with a sample or paste your own.</p></div></div>
              <button className="icon-button reset-button" aria-label="Reset to selected preset" onClick={() => updateSource(snippets[preset][language])}><RotateCcw aria-hidden="true" /></button>
            </div>
            <div className="editor-controls">
              <label className="select-label" htmlFor="preset">BUG PRESET</label>
              <div className="select-wrap"><select id="preset" value={preset} onChange={(event) => changePreset(event.target.value as Preset)}>{Object.entries(presetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></div>
              <span className="control-spacer" />
              <label className="select-label" htmlFor="language">LANGUAGE</label>
              <div className="select-wrap language-select"><select id="language" value={language} onChange={(event) => changeLanguage(event.target.value as Language)}><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="python">Python</option></select><ChevronDown aria-hidden="true" /></div>
            </div>
            <div className="editor-window">
              <div className="editor-filebar"><span className="file-dot" /><FileCode2 aria-hidden="true" /><span>untitled.{language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js'}</span><span className="filebar-status">UNSAVED</span></div>
              <div className="editor-body">
                <div className="line-gutter" aria-hidden="true">{lines.map((_, index) => <span className={highlightLine === index + 1 ? 'gutter-highlight' : ''} key={index}>{String(index + 1).padStart(2, '0')}</span>)}</div>
                <textarea className="code-editor" aria-label="Code to analyze" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={source} onChange={(event) => updateSource(event.target.value)} />
              </div>
              <div className="editor-footer"><span><span className="footer-dot" /> {lines.length} lines</span><span>UTF-8</span><span>{language.toUpperCase()}</span></div>
            </div>
            {error && <div className="error-message" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
            <button className="analyze-button" disabled={busy || !source.trim()} onClick={analyze}>{busy ? <><LoaderCircle className="spin" aria-hidden="true" /> Reading through your code…</> : <><Sparkles aria-hidden="true" /> Find the bug <ArrowRight aria-hidden="true" /></>}</button>
            <p className="private-note"><span className="lock-mark">◈</span> Your code is analyzed, never executed.</p>
          </section>

          <section className="diagnosis-panel panel" aria-labelledby="diagnosis-title">
            <div className="panel-heading diagnosis-heading">
              <div className="panel-title-group"><span className="panel-index">02</span><div><h2 id="diagnosis-title">Diagnosis</h2><p>A clear explanation, not just a patch.</p></div></div>
              <span className={`severity-pill severity-${diagnosis.severity}`}><span />{diagnosis.severity} severity</span>
            </div>
            <div className="diagnosis-content">
              <div className="summary-card"><div className="summary-icon"><TriangleAlert aria-hidden="true" /></div><div><span className="summary-label">THE SHORT VERSION</span><p>{diagnosis.summary}</p></div></div>
              <div className="finding-list">
                {diagnosis.findings.map((finding, index) => <article className="finding-card" key={`${finding.line}-${index}`}><div className="finding-meta"><span className="finding-number">0{index + 1}</span><span className="finding-line"><span className="line-dot" /> Line {finding.line}</span></div><h3>{finding.title}</h3><p>{finding.explanation}</p><div className="fix-note"><span>THE FIX</span><p>{finding.fix}</p></div></article>)}
                {diagnosis.findings.length === 0 && <div className="no-findings"><CheckCircle2 aria-hidden="true" /><p>No specific issue found. Review the corrected code and generated checks below.</p></div>}
              </div>
              <div className="reasoning-card"><div className="reasoning-heading"><Sparkles aria-hidden="true" /><span>MENTOR NOTES</span><span className="reasoning-label">STEP BY STEP</span></div><ol>{diagnosis.reasoning.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol></div>
            </div>
          </section>

          <section className="output-panel panel" aria-labelledby="output-title">
            <div className="panel-heading output-heading">
              <div className="panel-title-group"><span className="panel-index">03</span><div><h2 id="output-title">The better version</h2><p>Review the patch or inspect a static check.</p></div></div>
              <button className="copy-button" onClick={copyCode}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy patch'}</button>
            </div>
            <div className="output-tabs" role="tablist" aria-label="Output views"><button id="patch-tab" role="tab" aria-selected={activeTab === 'patch'} aria-controls="patch-view" className={activeTab === 'patch' ? 'tab-active' : ''} onClick={() => setActiveTab('patch')}><Code2 aria-hidden="true" /> Refactored code</button><button id="tests-tab" role="tab" aria-selected={activeTab === 'tests'} aria-controls="tests-view" className={activeTab === 'tests' ? 'tab-active' : ''} onClick={() => setActiveTab('tests')}><FlaskConical aria-hidden="true" /> Test suite <span className="tab-count">{diagnosis.tests.length}</span></button></div>
            {activeTab === 'patch' ? <div id="patch-view" role="tabpanel" aria-labelledby="patch-tab" className="patch-view"><div className="patch-filebar"><span className="patch-file-name"><FileCode2 aria-hidden="true" /> fixed.{language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js'}</span><span className="patch-change-count">{diagnosis.findings.length} {diagnosis.findings.length === 1 ? 'change' : 'changes'}</span></div><CodeBlock code={diagnosis.fixedCode} highlightLine={diagnosis.findings[0]?.line} /><div className="mentor-quote"><span className="quote-mark">“</span><p>A good fix should make the code easier to trust, not just harder to break.</p><span className="quote-byline">PATCHWORK MENTOR</span></div></div> : <div id="tests-view" role="tabpanel" aria-labelledby="tests-tab" className="tests-view"><div className="test-intro"><span className="test-intro-icon"><FlaskConical aria-hidden="true" /></span><div><h3>Static verification</h3><p>Checks syntax structure and confirms the patch is different. Submitted code is never executed.</p></div></div><div className="test-list"><div className="test-row"><span className={`test-status ${verification === 'passed' ? 'test-passed' : verification === 'failed' ? 'test-failed' : ''}`}>{verification === 'passed' ? <CheckCircle2 aria-hidden="true" /> : verification === 'failed' ? <X aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span><div><strong>Patch changes the source</strong><small>Compare the proposed code against the original input</small></div><span className="test-pending">{verification === 'idle' ? 'READY' : verification === 'passed' ? 'PASS' : 'FAIL'}</span></div><div className="test-row"><span className={`test-status ${verification === 'passed' ? 'test-passed' : verification === 'failed' ? 'test-failed' : ''}`}>{verification === 'passed' ? <CheckCircle2 aria-hidden="true" /> : verification === 'failed' ? <X aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span><div><strong>Balanced code delimiters</strong><small>Check parentheses, brackets, and braces in the patch</small></div><span className="test-pending">{verification === 'idle' ? 'READY' : verification === 'passed' ? 'PASS' : 'FAIL'}</span></div></div><div className="suggested-tests"><div className="suggested-heading"><span>AI-SUGGESTED CASES</span><span>NOT EXECUTED</span></div>{diagnosis.tests.map((test, index) => <div className="suggested-test" key={`${test.name}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{test.name}</strong><code>{test.input}</code></div><span className="expected-value">→ {test.expected}</span></div>)}</div><button className="run-tests-button" onClick={runStaticChecks}><Play aria-hidden="true" /> Run static checks</button>{verification === 'passed' && <p className="verification-result" role="status"><CheckCircle2 aria-hidden="true" /> Static checks passed. Behavioral test cases are suggestions, not executed code.</p>}{verification === 'failed' && <p className="verification-result verification-fail" role="status"><CircleAlert aria-hidden="true" /> Static checks found an issue with the patch.</p>}</div>}
            <div className="output-bottom"><div className="parser-log"><TerminalSquare aria-hidden="true" /><span>AST LOG</span><code>{diagnosis.parser.supported ? diagnosis.parser.errors.length ? `${diagnosis.parser.errors.length} parse ${diagnosis.parser.errors.length === 1 ? 'warning' : 'warnings'}` : 'source parsed' : 'parser unavailable for this language'}</code></div><button className="download-button" onClick={downloadPatch}><ArrowDownToLine aria-hidden="true" /> Download patch</button></div>
          </section>
        </div>
        {/* ── Sentinel: Security Review Agent ── */}
        <section className="sentinel-section" aria-labelledby="sentinel-title">
          <div className="sentinel-header">
            <div className="sentinel-title-group">
              <span className="sentinel-icon"><ShieldAlert aria-hidden="true" /></span>
              <div>
                <h2 id="sentinel-title">Sentinel <span className="sentinel-badge">AGENT 02</span></h2>
                <p>Security vulnerability scanner — OWASP Top 10 &amp; CWE analysis</p>
              </div>
            </div>
            <div className="sentinel-header-right">
              {securityReview && (
                <span className={`risk-pill risk-${securityReview.overallRisk}`}>
                  <span />{securityReview.overallRisk === 'none' ? 'No risk' : `${securityReview.overallRisk} risk`}
                </span>
              )}
              <button
                className="sentinel-run-button"
                disabled={securityBusy || !source.trim()}
                onClick={runSecurityReview}
              >
                {securityBusy
                  ? <><LoaderCircle className="spin" aria-hidden="true" /> Scanning…</>
                  : <><ShieldCheck aria-hidden="true" /> Run security scan <ArrowRight aria-hidden="true" /></>}
              </button>
            </div>
          </div>

          {securityError && (
            <div className="error-message sentinel-error" role="alert">
              <CircleAlert aria-hidden="true" />{securityError}
            </div>
          )}

          {!securityReview && !securityError && (
            <div className="sentinel-placeholder">
              <ShieldOff aria-hidden="true" />
              <p>Click <strong>Run security scan</strong> to have Sentinel check your code for vulnerabilities.</p>
            </div>
          )}

          {securityReview && (
            <div className="sentinel-body">
              <div className="sentinel-summary-bar">
                <ShieldAlert aria-hidden="true" />
                <p>{securityReview.summary}</p>
                <span className="sentinel-latency"><Clock3 aria-hidden="true" />{securityReview.latencyMs} ms</span>
              </div>

              <div className="sentinel-tabs" role="tablist">
                <button role="tab" aria-selected={securityTab === 'vulns'} className={securityTab === 'vulns' ? 'tab-active' : ''} onClick={() => setSecurityTab('vulns')}>
                  <ShieldAlert aria-hidden="true" /> Vulnerabilities <span className="tab-count">{securityReview.vulnerabilities.length}</span>
                </button>
                <button role="tab" aria-selected={securityTab === 'secure'} className={securityTab === 'secure' ? 'tab-active' : ''} onClick={() => setSecurityTab('secure')}>
                  <Code2 aria-hidden="true" /> Secure version
                </button>
                <button role="tab" aria-selected={securityTab === 'checklist'} className={securityTab === 'checklist' ? 'tab-active' : ''} onClick={() => setSecurityTab('checklist')}>
                  <CheckCircle2 aria-hidden="true" /> Checklist <span className="tab-count">{securityReview.checklist.filter(c => c.passed).length}/{securityReview.checklist.length}</span>
                </button>
              </div>

              {securityTab === 'vulns' && (
                <div className="vuln-list">
                  {securityReview.vulnerabilities.length === 0 && (
                    <div className="no-vulns">
                      <ShieldCheck aria-hidden="true" />
                      <p>No vulnerabilities detected. Your code passed Sentinel&apos;s security scan.</p>
                    </div>
                  )}
                  {securityReview.vulnerabilities.map((v, i) => (
                    <article className="vuln-card" key={i}>
                      <div className="vuln-meta">
                        <span className="finding-number">0{i + 1}</span>
                        <span className="finding-line"><span className="line-dot" style={{ background: v.severity === 'critical' ? '#ff6b7a' : v.severity === 'high' ? '#fa858d' : v.severity === 'medium' ? '#f0c776' : '#66d9a5' }} /> Line {v.line}</span>
                        <span className={`vuln-severity-tag sev-${v.severity}`}>{v.severity}</span>
                        <span className="vuln-cwe">{v.cwe}</span>
                      </div>
                      <h3>{v.type}</h3>
                      <p>{v.description}</p>
                      <div className="fix-note">
                        <span>REMEDIATION</span>
                        <p>{v.remediation}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {securityTab === 'secure' && (
                <div className="secure-view">
                  <div className="patch-filebar">
                    <span className="patch-file-name"><FileCode2 aria-hidden="true" /> secure.{language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js'}</span>
                    <button className="copy-button" onClick={copySecureCode}>
                      {secCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{secCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <CodeBlock code={securityReview.secureVersion} />
                </div>
              )}

              {securityTab === 'checklist' && (
                <div className="sec-checklist">
                  {securityReview.checklist.map((item, i) => (
                    <div className="sec-check-row" key={i}>
                      <span className={item.passed ? 'check-pass' : 'check-fail'}>
                        {item.passed ? <CheckCircle2 aria-hidden="true" /> : <X aria-hidden="true" />}
                      </span>
                      <span>{item.item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="page-footer"><span>PATCHWORK <span className="footer-version">/ V 1.0</span></span><span>Curiosity is a debugging tool.</span><span className="footer-online"><span className="status-dot" /> ALL SYSTEMS OPERATIONAL</span></footer>
      </div>
    </main>
  )
}

function checkBalancedDelimiters(code: string) {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: string[] = []
  let quote = ''
  let escaped = false
  for (const character of code) {
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'" || character === '`') quote = character
    else if (character === '(' || character === '[' || character === '{') stack.push(character)
    else if (character in pairs && stack.pop() !== pairs[character]) return false
  }
  return !quote && stack.length === 0
}
