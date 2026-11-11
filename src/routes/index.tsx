import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  CheckCircle,
  CircleUserRound,
  ChevronRight,
  CircleDollarSign,
  Code2,
  CreditCard,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  Globe2,
  History,
  LockKeyhole,
  LoaderCircle,
  Medal,
  Moon,
  Network,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AGENT_CONFIDENCE,
  DELEGATION_THRESHOLD,
  needsHumanExpertise,
  reviewSubmission,
  type MockReview,
} from "@/services/aiService";
import {
  emailVerificationCases,
  runDeterministicTests,
  type VerificationResult,
  validateSubmissionFormat,
} from "@/services/verificationService";
import { previewPayPalHandoff, type PaymentPreview } from "@/services/paypalService";
import {
  calculateMatchScore,
  createInitialWorkerDemoState,
  DEMO_BOUNTIES,
  DEMO_WORKER,
  loadWorkerDemoState,
  saveWorkerDemoState,
  WORKER_STORAGE_KEY,
  type DemoBounty,
  type DemoStage,
  type WorkerActivity,
  type WorkerDemoState,
  type WorkerSubmission,
} from "@/services/workerService";

type Stage = DemoStage;
type View = "command" | "board" | "worker" | "task" | "payment";
type WorkerTab = "available" | "active" | "history";

const CREATION_STEPS = [
  "Analyzing failure",
  "Generating requirements",
  "Creating verification criteria",
  "Setting reward",
  "Publishing bounty",
];

const VERIFICATION_STEPS = [
  { title: "Submitted", detail: "Solution received from the expert", icon: FileCheck2 },
  { title: "Automated validation", detail: "Required fields and patch format checked", icon: CheckCircle2 },
  { title: "AI evaluation", detail: "Requirements, expected behavior, and completeness", icon: Bot },
  { title: "Sandbox validation", detail: "Four local deterministic reference tests", icon: FlaskConical },
  { title: "Final verification", detail: "All required checks passed · reward eligible", icon: BadgeCheck },
  { title: "Payment release preview", detail: "Demo approval only · no funds transferred", icon: WalletCards },
];

const VERIFICATION_DESCRIPTION =
  "These local deterministic tests run against the built-in reference validator. The example patch in the editor is not executed.";

const DEMO_EXPERT_MATCHES = [
  {
    name: "Raghul",
    role: "Verified Developer",
    skills: "TypeScript · Internationalization",
    score: 98,
    reason: "12 verified fixes across TypeScript and internationalized domains.",
    initials: "R",
  },
  {
    name: "Maya Chen",
    role: "Protocol Engineer",
    skills: "Smart contracts · TypeScript",
    score: 94,
    reason: "Fast response history with 34 successful code reviews.",
    initials: "MC",
  },
  {
    name: "Dev Patel",
    role: "Full-stack Specialist",
    skills: "JavaScript · Validation",
    score: 87,
    reason: "Strong validation experience and a 96% acceptance rate.",
    initials: "DP",
  },
];

const IMPACT_METRICS = [
  { label: "Problems resolved", value: "1,248", detail: "+18% this month", icon: CheckCircle2 },
  { label: "Human solutions verified", value: "962", detail: "proof before payout", icon: ShieldCheck },
  { label: "Agents helped", value: "8,532", detail: "across the network", icon: Bot },
  { label: "Repeat escalations prevented", value: "73%", detail: "through memory reuse", icon: TrendingUp },
  { label: "Knowledge reuse rate", value: "68%", detail: "similar problems resolved", icon: BrainCircuit },
  { label: "Rewards distributed", value: "₹2.4L", detail: "verified work only", icon: CircleDollarSign },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgenticBounty — Human Escalation for AI Agents" },
      {
        name: "description",
        content:
          "An agentic-economy demo where Agent Alpha delegates difficult code to human experts, verifies the result, and previews a payment release.",
      },
      { property: "og:title", content: "AgenticBounty — Human Escalation for AI Agents" },
      {
        property: "og:description",
        content:
          "Watch an AI agent delegate a difficult email-validation problem, verify four tests, and unlock a demo payment handoff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: AgenticBounty,
});

function AgenticBounty() {
  const [view, setView] = useState<View>("command");
  const [stage, setStage] = useState<Stage>("idle");
  const [creationStep, setCreationStep] = useState(-1);
  const [verificationStep, setVerificationStep] = useState(-1);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [review, setReview] = useState<MockReview | null>(null);
  const [payment, setPayment] = useState<PaymentPreview | null>(null);
  const [workerDemo, setWorkerDemo] = useState<WorkerDemoState>(createInitialWorkerDemoState);
  const [workerTab, setWorkerTab] = useState<WorkerTab>("available");
  const [stateLoaded, setStateLoaded] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(window.localStorage.getItem("agenticbounty-theme") === "dark");
    const savedState = loadWorkerDemoState();
    if (savedState) {
      if (savedState.stage === "verified" || savedState.stage === "processing" || savedState.stage === "preview-complete") {
        const submissionCheck = validateSubmissionFormat(savedState.submission.solution);
        if (!submissionCheck.passed) {
          setWorkerDemo({ ...savedState, stage: "open", completed: false });
          setStage("open");
          setResults([submissionCheck]);
          toast.error("Saved verification is no longer valid", {
            description: "The saved solution failed the current submission-format check. Review and resubmit it.",
          });
        } else {
          setWorkerDemo(savedState);
          setStage(savedState.stage);
          setResults([submissionCheck, ...runDeterministicTests()]);
          setReview({
            score: 98,
            summary: "The solution covers internationalized domains and maintains standard email acceptance.",
          });
          if (savedState.stage === "preview-complete") {
            setPayment({
              status: "demo-complete",
              amount: 10,
              transactionCreated: false,
              message:
                "PayPal is not connected. This preview did not create a transaction, reserve funds, or move money.",
            });
          }
        }
      } else {
        setWorkerDemo(savedState);
        setStage(savedState.stage);
      }
    }
    setStateLoaded(true);
  }, []);

  useEffect(() => {
    if (stateLoaded) saveWorkerDemoState({ ...workerDemo, stage });
  }, [stage, stateLoaded, workerDemo]);

  useEffect(() => {
    if (stage !== "creating") return;

    let cancelled = false;
    const createBounty = async () => {
      for (let index = 0; index < CREATION_STEPS.length; index += 1) {
        if (cancelled) return;
        setCreationStep(index);
        await delay(450);
      }
      if (!cancelled) {
        setStage("open");
        setView("board");
        setWorkerDemo((current) => ({
          ...current,
          activity: [createActivity("Agent Alpha published the $10.00 email validation bounty."), ...current.activity],
        }));
        toast.success("Bounty published", {
          description: "The email validation task is now open to human experts.",
        });
      }
    };

    void createBounty();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "verifying") return;

    let cancelled = false;
    const verifySolution = async () => {
      setVerificationStep(0);
      await delay(350);
      if (cancelled) return;
      setVerificationStep(1);
      const submissionCheck = validateSubmissionFormat(workerDemo.submission.solution);
      await delay(350);
      if (cancelled) return;
      if (!submissionCheck.passed) {
        setResults([submissionCheck]);
        setStage("open");
        toast.error("Automated validation failed", {
          description: "The required validator is missing or its function body is incomplete.",
        });
        return;
      }

      setVerificationStep(2);
      const assessment = await reviewSubmission();
      if (cancelled) return;
      setReview(assessment);
      setVerificationStep(3);
      await delay(450);
      if (cancelled) return;
      const testResults = [submissionCheck, ...runDeterministicTests()];
      setResults(testResults);
      if (testResults.every((test) => test.passed)) {
        setVerificationStep(4);
        await delay(300);
        if (cancelled) return;
        setStage("verified");
        setWorkerDemo((current) => {
          if (current.completed) return current;
          return {
            ...current,
            completed: true,
            activity: [
              createActivity("Knowledge memory updated for future agents."),
              createActivity("Verification passed — $10.00 reward eligible for release."),
              ...current.activity,
            ],
          };
        });
        toast.success("Verification passed", {
          description: "All required checks passed. The $10.00 reward is eligible for release.",
        });
      } else {
        setStage("open");
        toast.error("Verification failed", {
          description: "The submitted solution did not pass validation. Improve it and resubmit.",
        });
      }
    };

    void verifySolution();
    return () => {
      cancelled = true;
    };
  }, [stage, workerDemo.submission.solution]);

  useEffect(() => {
    if (stage !== "processing") return;

    let cancelled = false;
    void previewPayPalHandoff(10).then((result) => {
      if (!cancelled) {
        setPayment(result);
        setStage("preview-complete");
        setWorkerDemo((current) => ({
          ...current,
          activity: [createActivity("Payment preview completed — no funds were moved."), ...current.activity],
        }));
        toast.success("Payment preview complete", {
          description: "No payment provider is connected. This approval preview did not create a transaction, reserve funds, or move money.",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const startOver = () => {
    setView("command");
    setStage("idle");
    setCreationStep(-1);
    setVerificationStep(-1);
    setResults([]);
    setReview(null);
    setPayment(null);
    const initialState = createInitialWorkerDemoState();
    setWorkerDemo(initialState);
    setWorkerTab("available");
    window.localStorage.removeItem(WORKER_STORAGE_KEY);
    setStateLoaded(true);
  };

  const addActivity = (message: string) => {
    setWorkerDemo((current) => ({
      ...current,
      activity: [createActivity(message), ...current.activity],
    }));
  };

  const claimBounty = (bounty: DemoBounty) => {
    if (!bounty.claimable || stage !== "open" || workerDemo.claimed) return;
    setWorkerDemo((current) => ({
      ...current,
      claimed: true,
      activity: [createActivity(`Claimed "${bounty.title}".`), ...current.activity],
    }));
    setWorkerTab("active");
    toast.success("Task claimed", {
      description: `${bounty.title} is now in your active tasks.`,
    });
  };

  const updateSubmission = (submission: WorkerSubmission) => {
    setWorkerDemo((current) => ({ ...current, submission }));
  };

  const startPaymentPreview = () => {
    if (stage !== "verified") {
      toast.error("Reward release is locked", {
        description: "The solution must pass verification before release can be previewed.",
      });
      return;
    }

    setPayment(null);
    setStage("processing");
    addActivity("Reward release preview started — no funds transferred.");
    setView("payment");
  };

  const canWork = stage === "open" || stage === "verifying" || stage === "verified" || stage === "processing" || stage === "preview-complete";
  const isVerified = stage === "verified" || stage === "processing" || stage === "preview-complete";
  const primaryBounty = DEMO_BOUNTIES[0];
  const availableEarnings = 0;
  const pendingEarnings = workerDemo.claimed ? primaryBounty.reward : 0;
  const totalEarned = DEMO_WORKER.totalEarned;
  const completedBounties = DEMO_WORKER.completedBounties + (workerDemo.completed ? 1 : 0);
  const successRate = workerDemo.completed
    ? Math.round((DEMO_WORKER.successRate * DEMO_WORKER.completedBounties + 100) / completedBounties)
    : DEMO_WORKER.successRate;
  const reputation = DEMO_WORKER.reputation + (workerDemo.completed ? 2 : 0);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    window.localStorage.setItem("agenticbounty-theme", next ? "dark" : "light");
  };

  return (
    <main className={`product-shell${isDark ? " dark" : ""} min-h-screen bg-background text-foreground`}>
      <div className="page-container">
        <Header
          view={view}
          setView={setView}
          onReset={startOver}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        <div className="product-rule" />
        <section className="intro-band" aria-labelledby="page-title">
          <div>
            <p className="eyebrow mb-3">HUMAN ESCALATION &amp; PAYMENT LAYER FOR AI AGENTS</p>
            <h1 id="page-title" className="intro-title">
              One human solution. <span>Thousands of smarter agents.</span>
            </h1>
            <p className="intro-copy">
              AI knows when to ask for help. Verified human knowledge makes the next agent smarter.
            </p>
          </div>
          <div className="intro-stats" aria-label="Network statistics">
            <div className="intro-stat">
              <span>HUMAN EXPERTS</span>
              <strong><span className="status-dot" /> Network available</strong>
            </div>
            <div className="intro-stat">
              <span>PAYMENT GATE</span>
              <strong><ShieldCheck size={14} /> Verify first</strong>
            </div>
          </div>
        </section>

        <WorkflowRail stage={stage} setView={setView} claimed={workerDemo.claimed} />

        {view === "command" && (
          <CommandCenter
            stage={stage}
            creationStep={creationStep}
            onCreate={() => setStage("creating")}
            onViewBoard={() => setView("board")}
            onViewWorker={() => setView("worker")}
            onViewTask={() => setView("task")}
            onViewPayment={() => setView("payment")}
          />
        )}
        {view === "board" && (
          <BountyBoard
            published={canWork}
            claimed={workerDemo.claimed}
            onOpenTask={() => setView("task")}
            onClaim={() => claimBounty(primaryBounty)}
            onReturn={() => setView("command")}
          />
        )}
        {view === "worker" && (
          <WorkerDashboard
            stage={stage}
            claimed={workerDemo.claimed}
            completed={workerDemo.completed}
            tab={workerTab}
            setTab={setWorkerTab}
            activity={workerDemo.activity}
            availableEarnings={availableEarnings}
            pendingEarnings={pendingEarnings}
            totalEarned={totalEarned}
            completedBounties={completedBounties}
            successRate={successRate}
            reputation={reputation}
            onClaim={() => claimBounty(primaryBounty)}
            onOpenTask={() => setView("task")}
            onOpenBoard={() => setView("board")}
          />
        )}
        {view === "task" && (
          <WorkerDesk
            stage={stage}
            submission={workerDemo.submission}
            setSubmission={updateSubmission}
            results={results}
            onSubmit={() => {
              setReview(null);
              setResults([]);
              setVerificationStep(-1);
              setWorkerDemo((current) => ({
                ...current,
                activity: [createActivity("Submitted a solution for verification."), ...current.activity],
              }));
              toast.info("Submission received", {
                description: "Automated validation and review start before any reward is eligible.",
              });
              setStage("verifying");
            }}
            review={review}
            verificationStep={verificationStep}
            isVerified={isVerified}
            claimed={workerDemo.claimed}
            published={canWork}
            onClaim={() => claimBounty(primaryBounty)}
            onPay={startPaymentPreview}
            onPayment={() => setView("payment")}
            onBoard={() => setView("board")}
            onWorker={() => setView("worker")}
            onReturn={() => setView("command")}
          />
        )}
        {view === "payment" && (
          <PaymentView
            stage={stage}
            payment={payment}
            onReturn={() => setView("task")}
            onReset={startOver}
            onBeginRelease={startPaymentPreview}
          />
        )}

        <Footer />
      </div>
    </main>
  );
}

function Header({
  view,
  setView,
  onReset,
  isDark,
  onToggleTheme,
}: {
  view: View;
  setView: (view: View) => void;
  onReset: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const navItems: { label: string; value: View; icon: typeof Zap }[] = [
    { label: "Command", value: "command", icon: Zap },
    { label: "Bounty board", value: "board", icon: Globe2 },
    { label: "Worker desk", value: "worker", icon: Code2 },
  ];

  return (
    <header className="site-header">
      <button className="brand-button" onClick={() => setView("command")} aria-label="AgenticBounty command center">
        <span className="brand-mark"><Bot size={22} strokeWidth={1.8} /></span>
        <span className="brand-text"><strong>agentic<span>bounty</span></strong><small>HUMAN ESCALATION LAYER</small></span>
      </button>
      <nav aria-label="Main navigation" className="desktop-nav">
        {navItems.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`nav-link${view === value ? " is-active" : ""}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="header-tools">
        <span className="online-indicator"><i /> <span>SYSTEM ONLINE</span></span>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${isDark ? "day" : "night"} mode`}
          title={`Switch to ${isDark ? "day" : "night"} mode`}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          <span>{isDark ? "Day mode" : "Night mode"}</span>
        </button>
        <Button variant="ghost" size="sm" onClick={onReset} className="reset-button">
          Reset demo
        </Button>
      </div>
      <nav aria-label="Small screen navigation" className="mobile-nav">
        {navItems.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            aria-label={label}
            aria-current={view === value ? "page" : undefined}
            className={view === value ? "mobile-nav-button is-active" : "mobile-nav-button"}
          ><Icon size={17} /></button>
        ))}
      </nav>
    </header>
  );
}

function WorkflowRail({
  stage,
  setView,
  claimed,
}: {
  stage: Stage;
  setView: (view: View) => void;
  claimed: boolean;
}) {
  const items = [
    { step: "01", label: "DELEGATE", view: "command" as const, active: stage === "idle" || stage === "creating", complete: stage !== "idle" && stage !== "creating" },
    { step: "02", label: "PUBLISH BOUNTY", view: "board" as const, active: stage === "open", complete: stage === "verifying" || stage === "verified" || stage === "processing" || stage === "preview-complete" },
    { step: "03", label: "VERIFY WORK", view: "task" as const, active: stage === "verifying" || stage === "verified" || (claimed && stage === "open"), complete: stage === "processing" || stage === "preview-complete" },
    { step: "04", label: "UNLOCK PAYMENT", view: "payment" as const, active: stage === "processing" || stage === "preview-complete", complete: stage === "preview-complete" },
  ];

  return (
    <nav className="workflow-rail" aria-label="Bounty workflow">
      {items.map(({ step, label, view, active, complete }, index) => (
        <div className={`workflow-step${active ? " is-active" : ""}${complete ? " is-complete" : ""}`} key={step}>
          <button onClick={() => setView(view)} disabled={view === "task" && !claimed && !complete && !active} className="workflow-step-button">
            <span className="workflow-index">{complete ? <Check size={12} /> : step}</span>
            <span>{label}</span>
          </button>
          {index < items.length - 1 && <span className="workflow-connector" aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}

function CommandCenter({
  stage,
  creationStep,
  onCreate,
  onViewBoard,
  onViewWorker,
  onViewTask,
  onViewPayment,
}: {
  stage: Stage;
  creationStep: number;
  onCreate: () => void;
  onViewBoard: () => void;
  onViewWorker: () => void;
  onViewTask: () => void;
  onViewPayment: () => void;
}) {
  const isCreating = stage === "creating";
  const hasPublished = stage !== "idle" && stage !== "creating";
  const isVerified = stage === "verified" || stage === "processing" || stage === "preview-complete";

  return (
    <div className="content-area">
      <div className="section-kicker"><span className="kicker-square" /> AGENT COMMAND CENTER <span className="kicker-line" /><span className="mono-label">WORKSPACE / ALPHA-01</span></div>
      <div className="command-grid">
        <section className="agent-panel">
          <div className="panel-topline"><span className="eyebrow">ACTIVE AGENT</span><span className="agent-id"><Fingerprint size={13} /> ID ALPHA-01</span></div>
          <div className="agent-title-row">
            <div className="agent-avatar"><Bot size={30} strokeWidth={1.6} /><span className="avatar-online" /></div>
            <div><h2>Agent Alpha</h2><p>Software engineering agent</p></div>
            <div className="needs-badge"><span /> NEEDS HUMAN HELP</div>
          </div>

          <div className="task-summary">
            <div className="task-summary-heading"><span className="task-icon"><Code2 size={16} /></span><span className="eyebrow">CURRENT TASK</span><span className="task-open">IN PROGRESS</span></div>
            <h3>Fix international email validation</h3>
            <p>The validation system rejects valid international email addresses. Multiple agent attempts haven’t produced a reliable fix.</p>
            <div className="task-meta"><span><Timer size={13} /> 12 min active</span><span><Globe2 size={13} /> Internationalization</span></div>
          </div>

          <div className="confidence-block">
            <div className="confidence-heading"><span className="eyebrow">AI CONFIDENCE</span><strong className="confidence-number">{AGENT_CONFIDENCE}<span>%</span></strong></div>
            <Progress value={AGENT_CONFIDENCE} aria-label={`AI confidence ${AGENT_CONFIDENCE}%`} className="confidence-progress" />
            <div className="confidence-foot"><span>DELEGATION THRESHOLD <b>{DELEGATION_THRESHOLD}%</b></span><span>{needsHumanExpertise(AGENT_CONFIDENCE) ? "BELOW THRESHOLD" : "WITHIN THRESHOLD"}</span></div>
            <div className="decision-signals" aria-label="Escalation decision factors">
              <div><span>RISK LEVEL</span><strong className="risk-high">HIGH</strong></div>
              <div><span>FAILED ATTEMPTS</span><strong>03</strong></div>
              <div><span>DIFFICULTY</span><strong>MEDIUM</strong></div>
            </div>
            <div className="decision-outcome">
              <span className="decision-pulse"><Sparkles size={14} /></span>
              <span><small>SMART ESCALATION DECISION</small><strong>{needsHumanExpertise(AGENT_CONFIDENCE) ? "Escalate to human experts" : "Continue autonomously"}</strong></span>
              <BadgeCheck size={17} />
            </div>
          </div>

          <AgentTimeline />
        </section>

        <aside className="escalation-column">
          <section className={`escalation-panel${hasPublished ? " is-published" : ""}`}>
            <div className="escalation-glyph"><UsersRound size={21} /></div>
            <p className="eyebrow">AUTONOMOUS DELEGATION</p>
            <h2>{hasPublished ? "Experts are on it." : "Human expertise, on demand."}</h2>
            <p className="escalation-copy">{hasPublished
              ? "The bounty is live on the network. Verification is the only path to payment."
              : "Agent Alpha’s confidence fell below its delegation threshold. A human expert can finish the task and earn a verified reward."}</p>
            {!hasPublished && (
              <Button onClick={onCreate} disabled={isCreating} className="create-bounty-button">
                {isCreating ? <><LoaderCircle size={17} className="spin" /> Publishing bounty</> : <>Create bounty <ArrowRight size={16} /></>}
              </Button>
            )}
            {isCreating && (
              <ol className="creation-steps" aria-live="polite">
                {CREATION_STEPS.map((step, index) => (
                  <li key={step} className={index < creationStep ? "is-complete" : index === creationStep ? "is-current" : ""}>
                    <span className="creation-step-icon">{index < creationStep ? <Check size={12} /> : index === creationStep ? <LoaderCircle size={12} className="spin" /> : <span>{String(index + 1).padStart(2, "0")}</span>}</span>{step}
                  </li>
                ))}
              </ol>
            )}
            {hasPublished && <Button onClick={onViewBoard} variant="secondary" className="published-button">View published bounty <ArrowRight size={15} /></Button>}
            <Button onClick={onViewWorker} variant="ghost" className="worker-shortcut">
              Open worker desk <ArrowRight size={14} />
            </Button>
            <div className="escalation-divider" />
            <div className="payment-promise"><LockKeyhole size={14} /><span>PAYMENT ONLY UNLOCKS AFTER VERIFIED WORK</span></div>
          </section>

          <section className="activity-panel">
            <div className="activity-heading"><span className="eyebrow">WORKFLOW ACTIVITY</span><span className="live-label"><i /> LIVE</span></div>
            <div className="activity-list">
              <ActivityItem icon={Bot} label="Agent Alpha" detail="Delegation threshold reached" status="now" color="blue" />
              {hasPublished && <ActivityItem icon={Zap} label="Bounty network" detail="Expert bounty published · $10.00" status="now" color="amber" />}
              {stage === "verified" && <ActivityItem icon={BadgeCheck} label="Verification engine" detail="Submission and four reference checks passed" status="now" color="green" />}
              {stage === "processing" && <ActivityItem icon={WalletCards} label="Payment handoff" detail="Preparing release approval preview" status="now" color="amber" />}
              {stage === "preview-complete" && <ActivityItem icon={ShieldCheck} label="Payment preview" detail="Demo complete · no funds moved" status="just now" color="green" />}
              {!hasPublished && <ActivityItem icon={Code2} label="Task runner" detail="International email edge case failed" status="2m ago" color="amber" />}
              {!hasPublished && <ActivityItem icon={Fingerprint} label="Network" detail="Awaiting human escalation" status="now" color="muted" />}
            </div>
            {stage === "verified" && <Button onClick={onViewTask} variant="link" size="sm" className="activity-link">Continue to payment <ArrowRight size={14} /></Button>}
            {stage === "preview-complete" && <Button onClick={onViewPayment} variant="link" size="sm" className="activity-link">View payment receipt <ArrowRight size={14} /></Button>}
          </section>

          <div className="side-proof"><div className="proof-icon"><ShieldCheck size={16} /></div><p><strong>Proof before payout.</strong><br />Deterministic checks hold the line. No verified result, no unlocked payment.</p></div>
        </aside>
      </div>
      <div className="bottom-strip"><span><CircleDollarSign size={14} /> <strong>$10.00</strong> bounty reward</span><span className="strip-divider" /><span>4 deterministic tests</span><span className="strip-divider" /><span>PAYPAL PAYMENT PREVIEW</span></div>
      <AgentEcosystemOverview />
      {isVerified && <KnowledgeImpact />}
      <ImpactMetricsDashboard />
    </div>
  );
}

function AgentEcosystemOverview() {
  const nodes = [
    { icon: Bot, label: "AI agent", detail: "Detects uncertainty", tone: "agent" },
    { icon: UsersRound, label: "Human expert", detail: "Solves the hard part", tone: "human" },
    { icon: BrainCircuit, label: "Shared memory", detail: "Teaches future agents", tone: "memory" },
  ];
  const networkStats = [
    { icon: Bot, value: "1,284", label: "Active agents" },
    { icon: Zap, value: "23", label: "Open bounties" },
    { icon: UsersRound, value: "416", label: "Human experts" },
    { icon: BrainCircuit, value: "962", label: "Knowledge memories" },
    { icon: BadgeCheck, value: "962", label: "Verified solutions" },
  ];

  return (
    <section className="ecosystem-overview" aria-labelledby="ecosystem-title">
      <div className="ecosystem-copy">
        <span className="eyebrow">HUMAN INTELLIGENCE × AGENT INTELLIGENCE</span>
        <h2 id="ecosystem-title">A better answer, <span>for every agent.</span></h2>
        <p>One verified human solution becomes reusable knowledge—not another dead-end retry.</p>
        <div className="ecosystem-proof"><span><Check size={13} /> Confidence-gated escalation</span><span><Check size={13} /> Verified before it becomes memory</span></div>
      </div>
      <div className="ecosystem-visual" aria-label="AI agent to human expert to shared knowledge flow">
        <div className="ecosystem-orbit ecosystem-orbit-one" />
        <div className="ecosystem-orbit ecosystem-orbit-two" />
        <div className="ecosystem-flow">
          {nodes.map(({ icon: Icon, label, detail, tone }, index) => (
            <div className="ecosystem-flow-group" key={label}>
              <div className="ecosystem-flow-item">
                <span className={`ecosystem-node is-${tone}`}><Icon size={18} /></span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
              {index < nodes.length - 1 && <span className="ecosystem-link"><i /></span>}
            </div>
          ))}
        </div>
        <div className="ecosystem-future"><Sparkles size={13} /> FUTURE AGENTS START SMARTER</div>
      </div>
      <div className="ecosystem-network-stats" aria-label="Illustrative ecosystem overview">
        {networkStats.map(({ icon: Icon, value, label }) => (
          <div className="ecosystem-network-stat" key={label}>
            <Icon size={14} /><strong>{value}</strong><span>{label}</span>
          </div>
        ))}
        <span className="ecosystem-stats-note">ILLUSTRATIVE DEMO COUNTS</span>
      </div>
    </section>
  );
}

function ImpactMetricsDashboard() {
  return (
    <section className="impact-dashboard" aria-labelledby="impact-title">
      <div className="impact-heading">
        <div>
          <span className="eyebrow">NETWORK-WIDE IMPACT</span>
          <h2 id="impact-title">Expertise that <span>compounds.</span></h2>
        </div>
        <span className="demo-metrics-label"><i /> ILLUSTRATIVE NETWORK METRICS</span>
      </div>
      <div className="impact-metrics">
        {IMPACT_METRICS.map(({ label, value, detail, icon: Icon }) => (
          <article className="impact-metric" key={label}>
            <span className="impact-metric-icon"><Icon size={16} /></span>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function KnowledgeImpact() {
  const stages = [
    { title: "Human solution", detail: "Expert contribution received" },
    { title: "Verified", detail: "4 deterministic checks passed" },
    { title: "Knowledge extracted", detail: "Reusable fix added to demo memory" },
    { title: "Future agents", detail: "Similar problems can resolve faster" },
  ];

  return (
    <section className="knowledge-impact" aria-labelledby="knowledge-impact-title">
      <div className="knowledge-impact-heading">
        <span className="memory-icon"><BrainCircuit size={20} /></span>
        <div><span className="eyebrow">CLOSED-LOOP LEARNING</span><h2 id="knowledge-impact-title">Agent memory updated</h2></div>
        <span className="memory-status"><i /> KNOWLEDGE ADDED</span>
      </div>
      <div className="knowledge-impact-body">
        <div className="knowledge-impact-copy">
          <p>One human fix is now a reusable reference for future agents facing the same international email edge case.</p>
          <div className="knowledge-impact-points">
            <span><CheckCircle2 size={14} /> 1 verified human solution</span>
            <span><CheckCircle2 size={14} /> Reusable by future AI agents</span>
            <span><CheckCircle2 size={14} /> Fewer repeated escalations</span>
          </div>
        </div>
        <div className="knowledge-loop" aria-label="Human solution flows through verification into agent memory">
          {stages.map(({ title, detail }, index) => (
            <div className="knowledge-loop-step" key={title}>
              <span className={index === stages.length - 1 ? "knowledge-loop-node is-future" : "knowledge-loop-node"}>
                {index === stages.length - 1 ? <Bot size={15} /> : <Check size={14} />}
              </span>
              <span><strong>{title}</strong><small>{detail}</small></span>
              {index < stages.length - 1 && <span className="knowledge-loop-connector" />}
            </div>
          ))}
        </div>
      </div>
      <div className="knowledge-impact-footer"><Sparkles size={14} /><strong>Humans solve once. AI learns continuously.</strong><span>Prototype memory simulation · no external AI service connected</span></div>
    </section>
  );
}

function AgentTimeline() {
  const steps = [
    { icon: CheckCircle2, label: "Task received", state: "is-done" },
    { icon: CheckCircle2, label: "Initial solution generated", state: "is-done" },
    { icon: X, label: "Tests failed", state: "is-failed" },
    { icon: CheckCircle2, label: "Alternative attempted", state: "is-done" },
    { icon: Timer, label: "Confidence threshold reached", state: "is-warning" },
  ];

  return (
    <div className="agent-timeline">
      <div className="timeline-heading"><span className="eyebrow">AGENT ACTIVITY</span><span>LAST 12 MIN</span></div>
      <div className="timeline-list">
        {steps.map(({ icon: Icon, label, state }) => <div key={label} className={`timeline-row ${state}`}><span className="timeline-icon"><Icon size={13} /></span><span>{label}</span></div>)}
      </div>
    </div>
  );
}

function WorkerDashboard({
  stage,
  claimed,
  completed,
  tab,
  setTab,
  activity,
  availableEarnings,
  pendingEarnings,
  totalEarned,
  completedBounties,
  successRate,
  reputation,
  onClaim,
  onOpenTask,
  onOpenBoard,
}: {
  stage: Stage;
  claimed: boolean;
  completed: boolean;
  tab: WorkerTab;
  setTab: (tab: WorkerTab) => void;
  activity: WorkerActivity[];
  availableEarnings: number;
  pendingEarnings: number;
  totalEarned: number;
  completedBounties: number;
  successRate: number;
  reputation: number;
  onClaim: () => void;
  onOpenTask: () => void;
  onOpenBoard: () => void;
}) {
  const isPublished = stage !== "idle" && stage !== "creating";
  const activeBounty = DEMO_BOUNTIES[0];
  const match = calculateMatchScore(DEMO_WORKER, activeBounty);
  const showActiveTask = claimed && !completed;

  return (
    <div className="content-area worker-dashboard">
      <div className="section-kicker"><span className="kicker-square" /> WORKER DASHBOARD <span className="kicker-line" /><span className="mono-label">PROFILE / RAGHUL</span></div>
      <div className="view-heading-row">
        <div>
          <h2 className="page-heading">Find your next <span>bounty.</span></h2>
          <p className="page-lede">Matched work, transparent verification, and rewards that unlock on proof.</p>
        </div>
        <div className="worker-heading-actions">
          <span className="network-live"><i /> {isPublished ? "NETWORK LIVE" : "AGENT STANDING BY"}</span>
          <Button variant="ghost" size="sm" onClick={onOpenBoard}>Bounty board <ArrowUpRight size={14} /></Button>
        </div>
      </div>

      <div className="worker-overview-grid">
        <section className="worker-profile-card">
          <div className="worker-profile-top">
            <span className="worker-profile-avatar"><CircleUserRound size={28} /></span>
            <span className="worker-verified"><BadgeCheck size={14} /> VERIFIED WORKER</span>
          </div>
          <h3>{DEMO_WORKER.name}</h3>
          <p>{DEMO_WORKER.role}</p>
          <div className="worker-skills">
            {DEMO_WORKER.skills.map((skill) => <span key={skill}>{skill}</span>)}
          </div>
          <div className="worker-reputation">
            <div><span className="eyebrow">REPUTATION</span><strong>{reputation}<small> / 100</small></strong></div>
            <div className="reputation-meter"><span style={{ width: `${reputation}%` }} /></div>
            {completed && <span className="reputation-update"><Medal size={12} /> +2 for verified work</span>}
          </div>
        </section>

        <section className="worker-stat-grid" aria-label="Worker performance">
          <WorkerStat icon={CheckCircle2} label="COMPLETED" value={String(completedBounties)} detail="bounties" tone="green" />
          <WorkerStat icon={ShieldCheck} label="SUCCESS RATE" value={`${successRate}%`} detail="verified submissions" tone="purple" />
          <WorkerStat icon={CircleDollarSign} label="TOTAL EARNED" value={formatCurrency(totalEarned)} detail="all-time rewards" tone="amber" />
        </section>
      </div>

      <section className="earnings-strip" aria-label="Earnings summary">
        <div><span className="earnings-icon is-green"><WalletCards size={16} /></span><span><small>AVAILABLE EARNINGS</small><strong>{formatCurrency(availableEarnings)}</strong></span></div>
        <div><span className="earnings-icon is-amber"><Timer size={16} /></span><span><small>REWARD RESERVED · DEMO</small><strong>{formatCurrency(pendingEarnings)}</strong></span></div>
        <div><span className="earnings-icon is-purple"><CircleDollarSign size={16} /></span><span><small>TOTAL EARNED</small><strong>{formatCurrency(totalEarned)}</strong></span></div>
        <div><span className="earnings-icon is-blue"><CheckCircle2 size={16} /></span><span><small>COMPLETED BOUNTIES</small><strong>{completedBounties}</strong></span></div>
      </section>
      <p className="earnings-note">Demo balances only. No real escrow or payment transfer is connected.</p>

      <section className="worker-marketplace">
        <div className="worker-tabs" role="tablist" aria-label="Worker tasks">
          <button role="tab" aria-selected={tab === "available"} className={tab === "available" ? "is-active" : ""} onClick={() => setTab("available")}>
            Available bounties <span>{DEMO_BOUNTIES.length}</span>
          </button>
          <button role="tab" aria-selected={tab === "active"} className={tab === "active" ? "is-active" : ""} onClick={() => setTab("active")}>
            My active tasks <span>{showActiveTask ? 1 : 0}</span>
          </button>
          <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "is-active" : ""} onClick={() => setTab("history")}>
            Activity history <span>{activity.length}</span>
          </button>
        </div>

        {tab === "available" && (
          <div className="available-bounty-list">
            {DEMO_BOUNTIES.map((bounty) => {
              const bountyMatch = calculateMatchScore(DEMO_WORKER, bounty);
              const isPrimary = bounty.id === activeBounty.id;
              const isCompleted = isPrimary && completed;
              const isClaimed = isPrimary && claimed && !completed;
              const canClaim = isPrimary && isPublished && !claimed;
              const status = isCompleted
                ? "VERIFIED"
                : isClaimed
                  ? "IN PROGRESS · RAGHUL"
                  : canClaim
                    ? "OPEN"
                    : isPrimary
                      ? "AWAITING AGENT"
                      : "PREVIEW";

              return (
                <article className={`worker-bounty-card${isPrimary ? " is-featured" : " is-preview"}`} key={bounty.id}>
                  <div className="worker-bounty-main">
                    <div className="worker-bounty-top">
                      <span className="bounty-category"><Code2 size={13} /> {bounty.category}</span>
                      <span className={`bounty-status${isClaimed || isCompleted ? " is-progress" : canClaim ? " is-open" : ""}`}>{status}</span>
                    </div>
                    <h3>{bounty.title}</h3>
                    <p>{bounty.description}</p>
                    <div className="worker-bounty-tags">
                      <span className="worker-bounty-reward"><CircleDollarSign size={12} /> {formatCurrency(bounty.reward)}</span>
                      <span>{bounty.difficulty}</span>
                      <span><FlaskConical size={12} /> {bounty.testCount} verification tests</span>
                      {bounty.requiredSkills.map((skill) => <span key={skill}>{skill}</span>)}
                    </div>
                  </div>
                  <div className="worker-match-panel">
                    <span className="eyebrow">AI MATCH</span>
                    <strong>{bountyMatch.score}<small>%</small></strong>
                    <span className={`match-level is-${bountyMatch.level.toLowerCase()}`}>{bountyMatch.level} match</span>
                    <details className="match-reasons">
                      <summary>Why this match?</summary>
                      <ul>{bountyMatch.reasons.map((reason) => <li key={reason}><Check size={12} /> {reason}</li>)}</ul>
                    </details>
                  </div>
                  <div className="worker-bounty-actions">
                    {isPrimary ? (
                      <Button variant="outline" onClick={onOpenTask}>
                        {isClaimed || isCompleted ? "View task" : "View details"}
                      </Button>
                    ) : (
                      <details className="preview-bounty-details">
                        <summary><FileCheck2 size={12} /> View details</summary>
                        <ul>{bounty.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
                      </details>
                    )}
                    {isPrimary ? (
                      isClaimed || isCompleted ? (
                        <Button onClick={onOpenTask}>{isCompleted ? "View completed task" : "Continue working"} <ArrowRight size={14} /></Button>
                      ) : (
                        <Button onClick={canClaim ? onClaim : onOpenBoard} disabled={!canClaim}>
                          {canClaim ? <>Claim task <ArrowRight size={14} /></> : "Waiting for bounty"}
                        </Button>
                      )
                    ) : (
                      <Button disabled title="A deterministic verification suite is not connected for this preview task">Verification soon</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {tab === "active" && (
          <div className="worker-list-content">
            {showActiveTask ? (
              <article className="active-task-card">
                <span className="active-task-icon"><Code2 size={19} /></span>
                <div className="active-task-copy">
                  <span className="eyebrow">{stage === "verifying" ? "VERIFICATION RUNNING" : "CLAIMED · JUST NOW"}</span>
                  <h3>{activeBounty.title}</h3>
                  <p>{activeBounty.testCount} deterministic checks · {formatCurrency(activeBounty.reward)} reward · AI match {match.score}%</p>
                </div>
                <span className="pending-reward"><LockKeyhole size={12} /> {formatCurrency(activeBounty.reward)} PENDING</span>
                <Button onClick={onOpenTask}>Continue working <ArrowRight size={14} /></Button>
              </article>
            ) : (
              <div className="worker-empty-state">
                <span className="pending-glyph"><Code2 size={22} /></span>
                <h3>No active tasks yet.</h3>
                <p>Claim an available bounty to start working and earning.</p>
                <Button onClick={() => setTab("available")}>Browse bounties <ArrowRight size={14} /></Button>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <WorkerActivityHistory activity={activity} completed={completed} onOpenTask={onOpenTask} />
        )}
      </section>
    </div>
  );
}

function WorkerStat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "purple" | "amber";
}) {
  return (
    <div className="worker-stat-card">
      <span className={`worker-stat-icon is-${tone}`}><Icon size={16} /></span>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function WorkerActivityHistory({
  activity,
  completed,
  onOpenTask,
}: {
  activity: WorkerActivity[];
  completed: boolean;
  onOpenTask: () => void;
}) {
  return (
    <div className="worker-list-content">
      {activity.length === 0 ? (
        <div className="worker-empty-state">
          <span className="pending-glyph"><History size={22} /></span>
          <h3>Your worker activity will appear here.</h3>
          <p>Claim and complete a bounty to start building your work history.</p>
        </div>
      ) : (
        <div className="worker-activity-list">
          {activity.map((entry) => (
            <div className="worker-activity-row" key={entry.id}>
              <span className={entry.message.includes("passed") || entry.message.includes("unlocked") ? "activity-icon is-green" : "activity-icon is-blue"}>
                {entry.message.includes("passed") || entry.message.includes("unlocked") ? <CheckCircle2 size={14} /> : <History size={14} />}
              </span>
              <strong>{entry.message}</strong>
              <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
            </div>
          ))}
          {completed && (
            <>
              <article className="active-task-card is-completed">
                <span className="active-task-icon"><CheckCircle2 size={19} /></span>
                <div className="active-task-copy">
                  <span className="eyebrow">VERIFIED · RELEASE ELIGIBLE</span>
                  <h3>{DEMO_BOUNTIES[0].title}</h3>
                  <p>All {DEMO_BOUNTIES[0].testCount} deterministic checks passed.</p>
                </div>
                <span className="pending-reward"><LockKeyhole size={12} /> {formatCurrency(DEMO_BOUNTIES[0].reward)} · DEMO</span>
                <Button onClick={onOpenTask}>View release status <ArrowRight size={14} /></Button>
              </article>
              <p className="worker-history-note"><ShieldCheck size={13} /> Verification improved your reputation. The reward remains a release preview; no funds moved.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityItem({
  icon: Icon,
  label,
  detail,
  status,
  color,
}: {
  icon: typeof Bot;
  label: string;
  detail: string;
  status: string;
  color: "blue" | "amber" | "green" | "muted";
}) {
  return (
    <div className="activity-item">
      <span className={`activity-icon is-${color}`}><Icon size={14} /></span>
      <span className="activity-text"><strong>{label}</strong><span>{detail}</span></span>
      <span className="activity-time">{status}</span>
    </div>
  );
}

function BountyBoard({
  published,
  claimed,
  onOpenTask,
  onClaim,
  onReturn,
}: {
  published: boolean;
  claimed: boolean;
  onOpenTask: () => void;
  onClaim: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="content-area">
      <div className="section-kicker"><span className="kicker-square" /> OPEN BOUNTY NETWORK <span className="kicker-line" /><span className="mono-label">03 AVAILABLE TASKS</span></div>
      <div className="view-heading-row"><div><h2 className="page-heading">Work that <span>matters.</span></h2><p className="page-lede">Human expertise, called in by agents. Demo reward release requires verification.</p></div><span className="network-live"><i /> NETWORK LIVE</span></div>

      {published ? (
        <article className="featured-bounty">
          <div className="featured-content">
            <div className="featured-top"><span className="posted-badge"><Bot size={13} /> AUTONOMOUSLY POSTED BY AGENT ALPHA</span><span className="open-badge"><i /> {claimed ? "IN PROGRESS · RAGHUL" : "OPEN"}</span></div>
            <h3>Fix international email validation</h3>
            <p className="featured-description">The current validator rejects valid international email addresses. Agent Alpha has exhausted its attempts and is looking for a human-reviewed solution.</p>
            <div className="requirement-list">
              <span><Check size={13} /> Support international domain formats</span>
              <span><Check size={13} /> Preserve valid standard email addresses</span>
              <span><Check size={13} /> Reject malformed addresses</span>
              <span><Check size={13} /> Pass all four automated checks</span>
            </div>
            <div className="featured-bottom">
              <div className="bounty-metrics"><span><FlaskConical size={14} /> 4 AUTOMATED TESTS</span><span><ShieldCheck size={14} /> VERIFIED BEFORE PAYMENT</span></div>
              <div className="featured-actions">
                <Button onClick={onOpenTask} variant="outline" className="task-open-button">{claimed ? "Continue working" : "View details"} <ArrowRight size={16} /></Button>
                {!claimed && <Button onClick={onClaim} className="task-open-button">Claim task <Check size={15} /></Button>}
              </div>
            </div>
          </div>
          <aside className="reward-panel">
            <span className="eyebrow">REWARD RESERVED · DEMO</span>
            <strong>$10<span>.00</span></strong>
            <span className="reward-subtitle">PENDING SOLUTION VERIFICATION</span>
            <div className="reward-guard">
              <LockKeyhole size={15} />
              <span>RELEASE ONLY AFTER<br />VALIDATION PASSES</span>
            </div>
            <div className="reward-bottom"><span>NO PAYMENT SERVICE CONNECTED</span></div>
          </aside>
        </article>
      ) : (
        <article className="bounty-pending">
          <span className="pending-glyph"><Bot size={25} /></span><div><span className="eyebrow">AGENT ALPHA · INCOMING BOUNTY</span><h3>A human expert is needed.</h3><p>The agent's failed attempt has been detected. Publish this task from the command center to open it to workers.</p></div><Button onClick={onReturn} variant="outline" className="pending-button">Return to command center <ArrowRight size={15} /></Button>
        </article>
      )}

      {published && <ExpertMatchPanel />}

      <div className="sample-heading"><span className="eyebrow">ON THE NETWORK</span><span>OTHER OPEN TASKS</span></div>
      <div className="sample-bounties">
        <SampleBounty tag="DATA QUALITY" title="Normalize public transit stop names" reward="$18.00" tests="6 tests" icon={Globe2} />
        <SampleBounty tag="ACCESSIBILITY" title="Improve keyboard focus in date picker" reward="$25.00" tests="9 tests" icon={Code2} />
      </div>
    </div>
  );
}

function ExpertMatchPanel() {
  return (
    <section className="expert-match-section" aria-labelledby="expert-match-title">
      <div className="expert-match-heading">
        <div>
          <span className="eyebrow">AI-ASSISTED ROUTING · DEMO MATCHES</span>
          <h2 id="expert-match-title">Best expert match</h2>
          <p>Ranked by skill relevance, verified experience, success rate, and response speed.</p>
        </div>
        <span className="expert-match-badge"><Sparkles size={13} /> MATCHING SIGNALS ACTIVE</span>
      </div>
      <div className="expert-match-list">
        {DEMO_EXPERT_MATCHES.map((expert, index) => (
          <article className={`expert-match-card${index === 0 ? " is-recommended" : ""}`} key={expert.name}>
            <span className="expert-avatar">{expert.initials}</span>
            <div className="expert-profile">
              <div><strong>{expert.name}</strong>{index === 0 && <span className="recommended-tag">TOP MATCH</span>}</div>
              <span>{expert.role} · {expert.skills}</span>
              <small><Check size={12} /> {expert.reason}</small>
            </div>
            <div className="expert-score"><strong>{expert.score}%</strong><span>COMPATIBILITY</span></div>
          </article>
        ))}
      </div>
      <p className="expert-match-footnote"><Network size={13} /> Simulated recommendations for this prototype. Scores combine skill fit, experience, prior outcomes, and response speed.</p>
    </section>
  );
}

function SampleBounty({
  tag,
  title,
  reward,
  tests,
  icon: Icon,
}: {
  tag: string;
  title: string;
  reward: string;
  tests: string;
  icon: typeof Globe2;
}) {
  return (
    <article className="sample-bounty"><span className="sample-icon"><Icon size={17} /></span><div className="sample-details"><span className="eyebrow">{tag}</span><h3>{title}</h3><span className="sample-tests"><FlaskConical size={12} /> {tests} <i /> VERIFICATION REQUIRED</span></div><strong className="sample-reward">{reward}</strong><ArrowUpRight className="sample-arrow" size={17} /></article>
  );
}

function WorkerDesk({
  stage,
  submission,
  setSubmission,
  results,
  onSubmit,
  review,
  verificationStep,
  isVerified,
  claimed,
  published,
  onClaim,
  onPay,
  onPayment,
  onBoard,
  onWorker,
  onReturn,
}: {
  stage: Stage;
  submission: WorkerSubmission;
  setSubmission: (submission: WorkerSubmission) => void;
  results: VerificationResult[];
  onSubmit: () => void;
  review: MockReview | null;
  verificationStep: number;
  isVerified: boolean;
  claimed: boolean;
  published: boolean;
  onClaim: () => void;
  onPay: () => void;
  onPayment: () => void;
  onBoard: () => void;
  onWorker: () => void;
  onReturn: () => void;
}) {
  const isVerifying = stage === "verifying";
  const hasBeenReviewed = results.length > 0;

  return (
    <div className="content-area">
      <div className="section-kicker"><span className="kicker-square" /> WORKER DESK <span className="kicker-line" /><span className="mono-label">BOUNTY / AB-0042</span></div>
      <div className="view-heading-row"><div><h2 className="page-heading">Ship the fix. <span>Prove it.</span></h2><p className="page-lede">A demo reward stays reserved until the solution passes validation.</p></div><div className="workspace-nav-actions"><Button variant="ghost" size="sm" onClick={onWorker} className="back-link"><CircleUserRound size={15} /> Worker dashboard</Button><Button variant="ghost" size="sm" onClick={onBoard} className="back-link"><ArrowLeft size={15} /> Bounty board</Button></div></div>
      {!published ? (
        <div className="bounty-pending worker-pending"><span className="pending-glyph"><LockKeyhole size={24} /></span><div><span className="eyebrow">NO OPEN BOUNTY YET</span><h3>Agent Alpha is standing by.</h3><p>Publish its request first, then discover and claim it from the worker dashboard.</p></div><Button onClick={onReturn} variant="outline" className="pending-button">Go to command center <ArrowRight size={15} /></Button></div>
      ) : !claimed ? (
        <div className="bounty-pending worker-pending"><span className="pending-glyph"><UsersRound size={24} /></span><div><span className="eyebrow">OPEN BOUNTY · $10.00</span><h3>Claim this task to get started.</h3><p>Claiming assigns this bounty to Raghul and adds it to My Active Tasks.</p></div><Button onClick={onClaim} className="pending-button">Claim task <ArrowRight size={15} /></Button></div>
      ) : (
        <div className="worker-grid">
          <div className="worker-main">
            <div className="worker-task-card">
              <div className="worker-task-top"><span className="posted-badge"><Bot size={13} /> AGENT ALPHA · ASSIGNED TO RAGHUL</span><span className="open-badge"><i /> {stage === "preview-complete" ? "RELEASE PREVIEWED" : isVerified ? "VERIFIED · RELEASE ELIGIBLE" : isVerifying ? "SUBMITTED FOR VERIFICATION" : hasBeenReviewed ? "VERIFICATION FAILED" : "IN PROGRESS"}</span></div>
              <h3>Fix international email validation</h3>
              <p className="worker-description">The current validation rejects valid email addresses using internationalized domains. Preserve standard email support while correctly validating IDN domains and malformed input.</p>
              <div className="worker-requirements"><span className="eyebrow">ACCEPTANCE CRITERIA</span>{DEMO_BOUNTIES[0].acceptanceCriteria.map((requirement, index) => <div key={requirement} className="acceptance-item"><span>{String(index + 1).padStart(2, "0")}</span>{requirement}</div>)}</div>
            </div>
            <div className="submission-panel">
              <div className="submission-heading"><div><span className="eyebrow">WORKER SUBMISSION</span><h3>Submit your patch</h3></div><span className="editor-language"><Code2 size={13} /> TYPESCRIPT</span></div>
              <div className="editor-frame"><div className="editor-toolbar"><div><i /><i /><i /></div><span>internationalEmail.ts</span><span>EXAMPLE PATCH</span></div><label htmlFor="worker-patch" className="sr-only">Example solution patch</label><textarea id="worker-patch" className="code-editor" spellCheck={false} value={submission.solution} onChange={(event) => setSubmission({ ...submission, solution: event.target.value })} disabled={isVerifying || isVerified} /><div className="editor-foot"><span><span className="editor-foot-dot" /> {isVerified ? "SUBMISSION VERIFIED" : isVerifying ? "CHECKS IN PROGRESS" : "EDITABLE EXAMPLE PATCH"}</span><span>{submission.solution.trim().split(/\s+/).filter(Boolean).length} TOKENS</span></div></div>
              <label className="submission-field">
                <span>Solution explanation</span>
                <textarea value={submission.explanation} onChange={(event) => setSubmission({ ...submission, explanation: event.target.value })} placeholder="Summarize your approach and any edge cases covered." disabled={isVerifying || isVerified} rows={3} />
              </label>
              <label className="submission-field">
                <span>GitHub URL <small>Optional</small></span>
                <input type="url" value={submission.githubUrl} onChange={(event) => setSubmission({ ...submission, githubUrl: event.target.value })} placeholder="https://github.com/you/your-solution" disabled={isVerifying || isVerified} />
              </label>
              <p className="editor-disclaimer">Demo mode: this example code is not executed. The test results below come from the independently tested local reference validator.</p>
              {!isVerified && <Button onClick={onSubmit} disabled={isVerifying || !submission.solution.trim()} className="submit-solution-button">{isVerifying ? <><LoaderCircle size={16} className="spin" /> Running verification</> : hasBeenReviewed ? <>Improve &amp; resubmit <ArrowRight size={16} /></> : <>Submit solution for verification <ArrowRight size={16} /></>}</Button>}
            </div>
          </div>
          <div className="worker-side">
            <div className={`reward-compact${isVerified ? " is-ready" : ""}`}>
              <div className="reward-compact-header">
                <span className="eyebrow">REWARD RESERVE · DEMO</span>
                {stage === "preview-complete" ? (
                  <span className="verified-flag"><CheckCircle2 size={13} /> PREVIEW COMPLETE</span>
                ) : isVerified ? (
                  <span className="verified-flag"><CheckCircle2 size={13} /> ELIGIBLE TO RELEASE</span>
                ) : stage === "verifying" ? (
                  <span className="locked-flag"><LoaderCircle size={12} className="spin" /> UNDER REVIEW</span>
                ) : (
                  <span className="locked-flag"><LockKeyhole size={12} /> RESERVED</span>
                )}
              </div>
              <strong>$10<span>.00</span></strong>
              <p>{isVerified ? "Verification passed. Release is eligible, but still only a preview." : "Reward secured — pending solution verification."}</p>
              {stage === "verified" && (
                <Button onClick={onPay} className="paypal-action">
                  <WalletCards size={17} /> Preview reward release <ArrowRight size={15} />
                </Button>
              )}
              {stage === "preview-complete" && (
                <Button onClick={onPayment} className="paypal-action">
                  View release preview <ArrowRight size={15} />
                </Button>
              )}
              <div className="reward-lock-line"><ShieldCheck size={13} /> NO REAL FUNDS ARE RESERVED OR TRANSFERRED</div>
            </div>

            {(isVerifying || hasBeenReviewed) && (
              <VerificationPanel
                isVerifying={isVerifying}
                results={results}
                review={review}
                verificationStep={verificationStep}
                isVerified={isVerified}
                stage={stage}
              />
            )}

            {hasBeenReviewed && results.some((result) => !result.passed) && (
              <div className="verification-failure" role="alert">
                <span className="failure-mark"><X size={17} /></span>
                <div>
                  <strong>Verification failed</strong>
                  <p>{results.find((result) => !result.passed)?.name}. Improve the patch and submit it again.</p>
                </div>
              </div>
            )}

            {isVerified && (
              <div className="verification-success">
                <span className="success-mark"><Check size={21} /></span>
                <div><span className="eyebrow">VERIFICATION SCORE</span><strong>{review?.score ?? 98}<small>%</small></strong></div>
                <span className="success-label">REWARD ELIGIBLE</span>
                <p>{review?.summary}</p>
                <span className="verified-protection"><ShieldCheck size={13} /> Validation passed. Release is eligible; no payment is sent in this demo.</span>
              </div>
            )}

            <div className="verify-trust"><Fingerprint size={17} /><div><strong>Verification before money</strong><span>Four deterministic checks lead. AI review is a secondary signal.</span></div></div>
          </div>
        </div>
      )}
      {isVerified && <KnowledgeImpact />}
      <div className="workflow-note"><ShieldCheck size={14} /><span>{VERIFICATION_DESCRIPTION}</span></div>
    </div>
  );
}

function VerificationPanel({
  isVerifying,
  results,
  review,
  verificationStep,
  isVerified,
  stage,
}: {
  isVerifying: boolean;
  results: VerificationResult[];
  review: MockReview | null;
  verificationStep: number;
  isVerified: boolean;
  stage: Stage;
}) {
  const validationPassed = results.length > 1 && results.every((result) => result.passed);
  const hasFailedValidation = results.some((result) => !result.passed);
  const stateLabel = isVerifying
    ? "RUNNING"
    : isVerified
      ? stage === "preview-complete"
        ? "VERIFIED · PREVIEWED"
        : "VERIFIED · RELEASE ELIGIBLE"
      : hasFailedValidation
        ? "VERIFICATION FAILED"
        : "PENDING";

  return (
    <div className="verification-panel" aria-live="polite">
      <div className="verification-panel-heading"><span className="eyebrow">SOLUTION VERIFICATION PIPELINE</span><span className={isVerifying ? "pipeline-state is-running" : isVerified ? "pipeline-state is-done" : hasFailedValidation ? "pipeline-state is-failed" : "pipeline-state"}>{isVerifying ? <><LoaderCircle size={12} className="spin" /> {stateLabel}</> : isVerified ? <><Check size={12} /> {stateLabel}</> : hasFailedValidation ? <><X size={12} /> {stateLabel}</> : stateLabel}</span></div>
      <div className="pipeline-steps">{VERIFICATION_STEPS.map(({ title, detail, icon: Icon }, index) => {
        const stepDone = index === 0
          ? verificationStep > 0 || results.length > 0 || isVerified
          : index === 1
            ? verificationStep > 1 || isVerified
            : index === 2
              ? review !== null
              : index === 3
                ? validationPassed
                : index === 4
                  ? isVerified
                  : stage === "preview-complete";
        const stepFailed =
          (index === 1 && results.length === 1 && hasFailedValidation) ||
          (index === 3 && results.length > 1 && hasFailedValidation) ||
          (index === 4 && results.length > 1 && hasFailedValidation);
        const stepActive = isVerifying && index === verificationStep;
        return (
          <div className={`pipeline-step${stepDone ? " is-done" : stepFailed ? " is-failed" : stepActive ? " is-active" : ""}`} key={title}>
            <span className="pipeline-icon"><Icon size={14} /></span>
            <span className="pipeline-step-text">
              <strong>{title}</strong>
              <small>{index === 2 && review ? review.summary : detail}</small>
            </span>
            {stepDone ? <CheckCircle2 className="pipeline-check" size={15} /> : stepFailed ? <X className="pipeline-error" size={15} /> : stepActive ? <LoaderCircle className="spin pipeline-spinner" size={14} /> : null}
          </div>
        );
      })}</div>
      {review && (
        <div className="ai-review-score">
          <div className="ai-review-heading"><span>AI verification confidence</span><strong>{review.score}%</strong></div>
          <Progress value={review.score} aria-label={`AI verification confidence ${review.score}%`} className="confidence-progress" />
          <p>AI analysis is one signal; release eligibility also requires automated and deterministic checks.</p>
        </div>
      )}
      {results.length > 0 && (
        <div className="test-results">
          <div className="test-results-heading">
            <span className="eyebrow">VALIDATION RESULTS</span>
            <span>{results.filter((result) => result.passed).length} / {results.length} PASSED</span>
          </div>
          {results.map((result, index) => (
            <div className={`test-result${result.passed ? " is-passed" : " is-failed"}`} key={result.name}>
              <span className="test-index">0{index + 1}</span>
              <span>{result.name}</span>
              {result.passed ? <CheckCircle2 size={15} /> : <X size={15} />}
            </div>
          ))}
          <div className="test-method-label"><ShieldCheck size={12} /> FORMAT CHECK + LOCAL REFERENCE TESTS · NO SUBMITTED CODE EXECUTED</div>
        </div>
      )}
    </div>
  );
}

function PaymentView({
  stage,
  payment,
  onReturn,
  onReset,
  onBeginRelease,
}: {
  stage: Stage;
  payment: PaymentPreview | null;
  onReturn: () => void;
  onReset: () => void;
  onBeginRelease: () => void;
}) {
  const isProcessing = stage === "processing";
  const isComplete = stage === "preview-complete";
  const isReady = stage === "verified";
  const isLocked = !isProcessing && !isComplete && !isReady;

  return (
    <div className="content-area">
      <div className="section-kicker"><span className="kicker-square" /> PAYMENT RELEASE <span className="kicker-line" /><span className="mono-label">DEMO PREVIEW · NO TRANSFER</span></div>
      <section className={`payment-screen${isComplete ? " is-complete" : ""}${isLocked ? " is-locked" : ""}`}>
        {isLocked ? (
          <div className="payment-lock-state"><span className="payment-state-icon is-locked"><LockKeyhole size={22} /></span><span className="eyebrow">REWARD RESERVED · DEMO</span><h2>Proof comes <span>before release.</span></h2><p>The $10.00 reward is reserved in this demo until the submission passes format checks and all four local deterministic tests. No real funds are held.</p><Button onClick={onReturn} className="back-to-work-button"><ArrowLeft size={15} /> Return to worker desk</Button></div>
        ) : isProcessing ? (
          <div className="payment-processing-state" aria-live="polite"><span className="payment-state-icon is-processing"><LoaderCircle size={25} className="spin" /></span><span className="eyebrow">RELEASE PREVIEW IN PROGRESS</span><h2>Approving the <span>demo release.</span></h2><p>Preparing a presentation-only preview for the verified $10.00 bounty. No payment provider is connected.</p><span className="processing-progress"><i /></span><PaymentFlow current="processing" /></div>
        ) : isReady ? (
          <div className="payment-ready-state"><span className="payment-state-icon is-ready"><ShieldCheck size={23} /></span><span className="eyebrow">VERIFICATION COMPLETE</span><h2>Reward is <span>eligible for release.</span></h2><p>Format validation and all four local reference tests passed. This is eligibility—not a payment transfer.</p><div className="ready-reward"><span>VERIFIED BOUNTY REWARD</span><strong>$10.00</strong><span><CheckCircle2 size={13} /> ALL VALIDATION CHECKS PASSED</span></div><Button onClick={onBeginRelease} className="paypal-action"><WalletCards size={16} /> Preview reward release <ArrowRight size={15} /></Button><PaymentFlow current="ready" /></div>
        ) : (
          <div className="payment-success-state">
            <span className="success-orbit orbit-one" /><span className="success-orbit orbit-two" />
            <span className="payment-state-icon is-success"><Check size={27} strokeWidth={2.4} /></span>
            <span className="eyebrow">RELEASE PREVIEW COMPLETE</span>
            <h2>Verified work. <span>Release approved.</span></h2>
            <p>The reward release was simulated successfully. No real money was paid, reserved, or transferred.</p>
            <div className="payment-receipt"><div><span>BOUNTY REWARD</span><strong>$10.00</strong></div><div><span>VERIFICATION</span><strong className="receipt-verified"><CheckCircle2 size={14} /> PASSED · 5 / 5</strong></div><div><span>PAYMENT METHOD</span><strong><WalletCards size={15} /> PayPal not connected</strong></div><div><span>PAYMENT STATUS</span><strong className="receipt-demo"><CheckCircle size={14} /> PREVIEW APPROVED · NOT TRANSFERRED</strong></div></div>
            {payment && <div className="demo-disclaimer"><span><ShieldCheck size={16} /></span><p><strong>No real transaction was made.</strong><br />{payment.message}</p></div>}
            <PaymentFlow current="complete" />
            <div className="success-actions"><Button onClick={onReset} variant="outline" className="new-demo-button">Restart demo <Zap size={15} /></Button></div>
          </div>
        )}
        {isLocked && <PaymentFlow current="locked" />}
      </section>
      {isComplete && <div className="workflow-note"><ShieldCheck size={14} /><span>This preview never moves funds. Connecting a payment provider and implementing escrow/release is required for real payouts.</span></div>}
    </div>
  );
}

function PaymentFlow({ current }: { current: "locked" | "ready" | "processing" | "complete" }) {
  const stages = [
    { label: "AI agent", detail: "Created bounty", icon: Bot, reached: true },
    { label: "Human expert", detail: "Submitted solution", icon: UsersRound, reached: true },
    { label: "Verification", detail: current === "locked" ? "Tests pending" : "Tests passed", icon: ShieldCheck, reached: current !== "locked" },
    { label: "Release preview", detail: current === "complete" ? "Approved · no transfer" : current === "processing" ? "Preparing preview" : current === "ready" ? "Eligible after verification" : "Locked until verified", icon: WalletCards, reached: current === "processing" || current === "complete" },
  ];

  return (
    <div className="payment-flow"><span className="eyebrow">VERIFIED BOUNTY FLOW</span><div className="payment-flow-steps">{stages.map(({ label, detail, icon: Icon, reached }, index) => <div className={`payment-flow-step${reached ? " is-reached" : ""}${index === 3 && current === "processing" ? " is-processing" : ""}`} key={label}><div className="payment-flow-node"><Icon size={17} /></div><span className="payment-flow-name">{label}</span><span className="payment-flow-detail">{detail}</span>{index < stages.length - 1 && <span className="payment-flow-connector" />}</div>)}</div></div>
  );
}

function Footer() {
  return (
    <footer className="site-footer"><span>AGENTICBOUNTY <span className="footer-separator">/</span> HUMAN ESCALATION PROTOCOL</span><span><i className="footer-dot" /> LOCAL DEMO ENVIRONMENT</span></footer>
  );
}

function createActivity(message: string): WorkerActivity {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    timestamp: new Date().toISOString(),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}