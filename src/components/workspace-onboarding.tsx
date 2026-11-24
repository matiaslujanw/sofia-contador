"use client";

import { Check, Compass } from "lucide-react";
import Link from "next/link";
import { useState, type MouseEventHandler } from "react";
import { sectionGuide, type OnboardingStep } from "@/lib/workspace/onboarding";
import { sections, type Section, type Selection } from "@/lib/workspace/routes";
import type { Context } from "./workspace-context";
import { Modal, Progress } from "./workspace-ui";

type GuideProps = {
  steps: OnboardingStep[];
  section: Section;
  selection: Selection;
  purpose?: string;
  href: Context["href"];
};

function stepLink(step: OnboardingStep, { href }: GuideProps) {
  const { section, companyId, month, purpose, anchor } = step.destination;
  const url = href(section, { companyId, ...(month ? { month } : {}) }, purpose ? { tipo: purpose } : undefined);
  return anchor ? `${url}#${anchor}` : url;
}

export function NextWorkspaceStep({ openGuide, ...props }: GuideProps & { openGuide: MouseEventHandler<HTMLButtonElement> }) {
  const index = props.steps.findIndex((step) => !step.done);
  const step = props.steps[index];
  if (!step) return null;

  const { section, companyId, month, purpose } = step.destination;
  const onDestination = (step.id === "studio" || section === props.section)
    && (!companyId || companyId === props.selection.companyId)
    && (!month || month === props.selection.month)
    && (!purpose || purpose === props.purpose);

  return <section className="tour-panel" aria-labelledby="onboarding-next">
    <div className="tour-panel-heading">
      <span className="tour-step-icon"><Compass size={20} aria-hidden="true" /></span>
      <div>
        <p className="tour-step-label">Primeros pasos · {index + 1} de {props.steps.length}</p>
        <h2 id="onboarding-next">{step.title}</h2>
      </div>
    </div>
    <p className="tour-instruction">{step.instruction}</p>
    <div className="tour-panel-footer">
      {!onDestination && <Link className="button button-primary" href={stepLink(step, props)}>{step.action}</Link>}
      <button className="button button-secondary" type="button" onClick={openGuide}>Ver el recorrido</button>
    </div>
  </section>;
}

export function WorkspaceGuide({ close, restoreFocus, ...props }: GuideProps & { close: () => void; restoreFocus: () => void }) {
  const { steps, section, selection, href } = props;
  const next = steps.find((step) => !step.done);
  const completed = steps.filter((step) => step.done).length;
  const [tab, setTab] = useState<"steps" | "sections">(next ? "steps" : "sections");
  return <Modal title="Guía de Sofía" description={selection.organizationId
    ? "Usá los selectores de arriba para cambiar de empresa o de mes."
    : "Seguí los pasos para empezar a organizar tu estudio."} close={close} restoreFocus={restoreFocus}>
    {steps.length > 0 && <div className="segments" aria-label="Contenido de la guía">
      <button className="segment" type="button" aria-pressed={tab === "steps"} onClick={() => setTab("steps")}>Primeros pasos</button>
      <button className="segment" type="button" aria-pressed={tab === "sections"} onClick={() => setTab("sections")}>Qué hace cada sección</button>
    </div>}
    {tab === "steps" && <section className="onboarding-guide-steps" aria-labelledby="onboarding-steps">
      <div className="onboarding-guide-heading">
        <h3 id="onboarding-steps" className="sr-only">Primeros pasos</h3>
        <span>{completed} de {steps.length} completos</span>
      </div>
      <Progress value={Math.round(completed * 100 / steps.length)} label="Avance de los primeros pasos" />
      <ol className="onboarding-checklist">
        {steps.map((step, index) => <li key={step.id} aria-current={step === next ? "step" : undefined}>
          <span className="onboarding-step-number" data-done={step.done} aria-hidden="true">
            {step.done ? <Check size={15} /> : index + 1}
          </span>
          <div>
            <h4>{step.title}{step.done && <span className="sr-only"> · Completado</span>}</h4>
            <p>{step === next ? step.instruction : step.description}</p>
            {step === next && <Link className="button button-primary" href={stepLink(step, props)} onClick={close}>{step.action}</Link>}
          </div>
        </li>)}
      </ol>
    </section>}
    {tab === "sections" && <section className="onboarding-sections" aria-labelledby="onboarding-sections">
      <h3 className={steps.length ? "sr-only" : undefined} id="onboarding-sections">Qué hace cada sección</h3>
      <dl>
        {(Object.keys(sectionGuide) as Section[]).map((key) => <div key={key} data-current={key === section && !!selection.organizationId}>
          <dt>{selection.organizationId
            ? <Link href={href(key)} onClick={close}>{sections[key]}</Link>
            : sections[key]}</dt>
          <dd>{sectionGuide[key]}</dd>
        </div>)}
      </dl>
    </section>}
  </Modal>;
}
