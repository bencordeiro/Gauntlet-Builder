/**
 * Validation and risk panel.
 *
 * Warnings are grouped by severity and every one carries a jump-to-step action,
 * because a warning the user has to hunt for is a warning they will ignore.
 */

import type { ValidationWarning, WarningSeverity } from '../../model/types';
import { Button } from '../ui';
import { AlertCircle, CheckCircle, Info, Lightbulb, Warning } from '../ui/Icons';
import './RiskPanel.css';

const SEVERITY_META: Record<
  WarningSeverity,
  { label: string; icon: typeof Info; tone: string; plural: string }
> = {
  blocking: { label: 'Must be fixed', icon: AlertCircle, tone: 'danger', plural: 'Must be fixed' },
  warning: { label: 'Worth fixing', icon: Warning, tone: 'warn', plural: 'Worth fixing' },
  recommendation: { label: 'Suggestion', icon: Lightbulb, tone: 'info', plural: 'Suggestions' },
  info: { label: 'Note', icon: Info, tone: 'neutral', plural: 'Notes' },
};

const ORDER: WarningSeverity[] = ['blocking', 'warning', 'recommendation', 'info'];

interface Props {
  warnings: ValidationWarning[];
  onGoToStep?: (step: number) => void;
  /** Hides the all-clear state, for embedding where space is tight. */
  hideWhenClean?: boolean;
}

export function RiskPanel({ warnings, onGoToStep, hideWhenClean }: Props) {
  if (warnings.length === 0) {
    if (hideWhenClean) return null;
    return (
      <div className="risk-clean">
        <CheckCircle size={18} />
        <div>
          <p className="risk-clean-title">Nothing looks wrong</p>
          <p className="text-sm text-secondary">
            No configuration problems found. That does not guarantee good results — but it does mean
            this Gauntlet can actually reach a conclusion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="risk-panel">
      {ORDER.map((severity) => {
        const group = warnings.filter((w) => w.severity === severity);
        if (group.length === 0) return null;
        const meta = SEVERITY_META[severity];
        const Icon = meta.icon;

        return (
          <section className="risk-group" key={severity}>
            <h3 className="risk-group-title" data-tone={meta.tone}>
              <Icon size={14} />
              {meta.plural}
              <span className="risk-group-count">{group.length}</span>
            </h3>

            <ul className="risk-list">
              {group.map((warning) => (
                <li className="risk-item" key={`${warning.code}-${warning.title}`} data-tone={meta.tone}>
                  <div className="risk-item-body">
                    <p className="risk-item-title">{warning.title}</p>
                    <p className="risk-item-problem">{warning.problem}</p>
                    <p className="risk-item-fix">
                      <strong>Fix:</strong> {warning.suggestion}
                    </p>
                  </div>
                  {warning.step !== undefined && onGoToStep && (
                    <Button size="sm" onClick={() => onGoToStep(warning.step!)}>
                      Go to step {warning.step}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
