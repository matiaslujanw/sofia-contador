"use client";

import { Building2, Check, ClipboardCheck, Compass, Download, FileSpreadsheet, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { workspaceHref, type Section, type Selection } from "@/lib/workspace/routes";
import { emptyTourProgress, readTourProgress, sampleTourCsv, saveTourProgress, subscribeTourProgress, tourHref, tourSteps } from "@/lib/workspace/tour";
import { Modal } from "./workspace-ui";

const icons = [Building2, ClipboardCheck, ReceiptText, FileSpreadsheet];

export function TourEntry({ selection }: { selection: Selection }) {
  const progress = useSyncExternalStore(subscribeTourProgress, readTourProgress, emptyTourProgress);
  const next = progress > 0 && progress <= tourSteps.length ? progress : 0;
  return <Link className="tour-entry" href={tourHref(next, selection)}>
    <Compass size={17} aria-hidden="true" /><span>{next ? "Retomar recorrido" : "Recorrido guiado"}</span>
  </Link>;
}

type TourProps = {
  step: number;
  sample: Selection;
  current: Selection;
  section: Section;
  continuing?: Record<string, string>;
  companyName: string;
  taskTitle: string;
  sampleSelected: boolean;
  portable: boolean;
  editable: boolean;
  close: (href: string) => void;
};

export function WorkspaceTour({ step, sample, current, section, continuing, companyName, taskTitle, sampleSelected, editable, portable, close }: TourProps) {
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const currentStep = tourSteps[step - 1];
  const exit = workspaceHref(section, current, continuing);
  const home = workspaceHref("inicio", { ...sample, companyId: undefined });
  const instructions = [
    <>Arriba podés ver la empresa y el mes activos. Ese contexto se usa en el cierre, los comprobantes y los respaldos de <strong>{companyName}</strong>.</>,
    editable
      ? <>Abrí <strong>{taskTitle}</strong> y probá marcar la tarea como completada. El avance se actualiza al guardar.</>
      : <>Abrí <strong>{taskTitle}</strong> para ver su estado y sus observaciones. Podés consultar las tareas de este período.</>,
    <>Abrí la compra de <strong>Equipamientos Norte</strong> para ver el IVA, el total y la cuenta asignada.</>,
    editable
      ? <>Descargá el CSV de muestra y elegí <strong>Seleccionar archivo</strong>. Revisá las columnas y confirmá la importación.</>
      : <>Consultá el <strong>Historial de importaciones</strong>. Para cargar una planilla, elegí un período abierto de una empresa activa.</>,
  ];

  useEffect(() => {
    if (step > 0) saveTourProgress(step);
    if (currentStep) stepHeading.current?.focus({ preventScroll: true });
  }, [currentStep, step]);

  if (step === 0 || !currentStep) {
    const finished = step > 0;
    return <Modal
      title={finished ? "Recorrido completado" : "Conocé Sofía"}
      description={finished
        ? "Ahora podés seguir explorando el espacio de trabajo de demostración."
        : portable
          ? "Practicá con datos ficticios. Los cambios duran mientras el archivo esté abierto."
          : "Un recorrido práctico para organizar un cierre mensual con datos ficticios."}
      close={() => close(finished ? home : exit)}
    >
      {finished ? <div className="tour-finish">
        <span aria-hidden="true"><Check size={26} /></span>
        <p>Volvé a Empresas para elegir dónde trabajar o retomá el recorrido desde el encabezado.</p>
      </div> : <ol className="tour-preview">
        {tourSteps.map((item, index) => {
          const Icon = icons[index];
          return <li key={item.section}><Icon size={18} aria-hidden="true" /><strong>{item.title}</strong></li>;
        })}
      </ol>}
      <div className="form-actions">
        <Link href={finished ? tourHref(1, sample) : exit} className="button button-secondary">{finished ? "Repetir recorrido" : "Explorar por mi cuenta"}</Link>
        <Link href={finished ? home : tourHref(1, sample)} className="button button-primary">{finished ? "Volver a empresas" : "Empezar recorrido"}</Link>
      </div>
    </Modal>;
  }

  const Icon = icons[step - 1];
  const correctScope = sampleSelected && currentStep.section === section;
  const csv = step === 4 && editable && correctScope ? `data:text/csv;charset=utf-8,${encodeURIComponent(sampleTourCsv(sample.month))}` : null;
  return <section className="tour-panel" aria-label="Recorrido guiado">
    <div className="tour-panel-heading">
      <span className="tour-step-icon"><Icon size={21} aria-hidden="true" /></span>
      <div>
        <p className="tour-step-label">Paso {step} de {tourSteps.length}</p>
        <h2 tabIndex={-1} ref={stepHeading}>{currentStep.title}</h2>
      </div>
      <Link href={exit} className="icon-button tour-exit" aria-label="Salir del recorrido" title="Salir del recorrido"><X size={19} aria-hidden="true" /></Link>
    </div>
    <p className="tour-instruction">{correctScope ? instructions[step - 1] : <>Volvé al período de ejemplo de <strong>{companyName}</strong> para hacer este paso.</>}</p>
    <div className="tour-panel-footer">
      <div className="tour-progress" aria-hidden="true">
        {tourSteps.map((item, index) => <span key={item.section} data-reached={index < step} />)}
      </div>
      {!correctScope && <Link href={tourHref(step, sample)} className="button button-secondary">Volver al ejemplo</Link>}
      {correctScope && (step === 2 || step === 3) && <Link href={tourHref(step, sample, true)} className="button button-secondary">
        {step === 2 ? "Abrir tarea de ejemplo" : "Abrir comprobante de ejemplo"}
      </Link>}
      {csv && <a className="button button-secondary" href={csv} download="sofia-compra-de-prueba.csv"><Download size={16} aria-hidden="true" /> Descargar CSV de muestra</a>}
      <div className="tour-navigation">
        {step > 1 && <Link href={tourHref(step - 1, sample)} className="button button-secondary">Anterior</Link>}
        <Link href={tourHref(step + 1, sample)} className="button button-primary">{step === tourSteps.length ? "Finalizar recorrido" : "Siguiente"}</Link>
      </div>
    </div>
  </section>;
}
