/*
 * A row of numbered steps, ported from ezBookkeeping's StepsBar.vue (MIT, see THIRD_PARTY_NOTICES.md).
 * Each step: a ring, its number ("01"), a title and a subtitle, joined by short lines. Steps up to the current
 * one are drawn at full strength; later ones are faint. On narrow screens the steps stack.
 */

export interface StepItem {
  name: string;
  title: string;
  subTitle: string;
}

interface StepsBarProps {
  steps: StepItem[];
  currentStep: string;
  /** Called with the step clicked. Leave out to make the steps plain labels. */
  onStepChange?: (name: string) => void;
}

export function StepsBar({ steps, currentStep, onStepChange }: StepsBarProps) {
  const currentIndex = steps.findIndex((step) => step.name === currentStep);
  return (
    <ol className="steps-bar">
      {steps.map((step, index) => {
        const state = index < currentIndex ? "completed" : index === currentIndex ? "active" : "upcoming";
        const label = (
          <>
            <span className="steps-bar__indicator" aria-hidden="true" />
            <span className="steps-bar__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="steps-bar__text">
              <span className="steps-bar__title">{step.title}</span>
              <span className="steps-bar__subtitle">{step.subTitle}</span>
            </span>
          </>
        );
        return (
          <li key={step.name} className={`steps-bar__step steps-bar__step--${state}`} aria-current={state === "active" ? "step" : undefined}>
            {onStepChange ? (
              <button type="button" className="steps-bar__button" onClick={() => onStepChange(step.name)}>
                {label}
              </button>
            ) : (
              <span className="steps-bar__button">{label}</span>
            )}
            {index < steps.length - 1 ? <span className="steps-bar__line" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
