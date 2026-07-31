/**
 * Shared form and layout controls.
 *
 * Built on Radix primitives for the behaviours that are easy to get subtly
 * wrong (focus trapping, roving tabindex, typeahead, escape handling) with all
 * visual styling written here. Every control accepts a label and wires up
 * `aria-describedby` for its help text, so callers cannot accidentally ship an
 * unlabelled input.
 */

import * as RAccordion from '@radix-ui/react-accordion';
import * as RCheckbox from '@radix-ui/react-checkbox';
import * as RDialog from '@radix-ui/react-dialog';
import * as RSelect from '@radix-ui/react-select';
import * as RSwitch from '@radix-ui/react-switch';
import * as RTabs from '@radix-ui/react-tabs';
import * as RTooltip from '@radix-ui/react-tooltip';
import {
  useCallback,
  useId,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  Lightbulb,
  Plus,
  Trash,
  Warning,
  X,
} from './Icons';
import './controls.css';

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    iconOnly ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}

/* ------------------------------------------------------------------ *
 * Tooltip / help
 * ------------------------------------------------------------------ */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={250} skipDelayDuration={300}>
      {children}
    </RTooltip.Provider>
  );
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="tooltip-content" sideOffset={6} collisionPadding={12}>
          {content}
          <RTooltip.Arrow className="tooltip-arrow" width={10} height={5} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** Small "?" affordance for explaining a term inline. */
export function Help({ text, label }: { text: ReactNode; label?: string }) {
  return (
    <Tooltip content={text}>
      <button type="button" className="help-trigger" aria-label={label ?? 'More information'}>
        ?
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ *
 * Field wrapper
 * ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  help?: ReactNode;
  /** Rendered as a tooltip next to the label rather than below the control. */
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  help,
  hint,
  error,
  optional,
  htmlFor,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="field-optional">optional</span>}
        {hint && <Help text={hint} label={`About ${label}`} />}
      </label>
      {help && <p className="field-help">{help}</p>}
      {children}
      {error && (
        <p className="field-error" role="alert">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Text inputs
 * ------------------------------------------------------------------ */

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  help,
  hint,
  error,
  optional,
  disabled,
  autoFocus,
  maxLength,
}: TextInputProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  return (
    <Field label={label} help={help} hint={hint} error={error} optional={optional} htmlFor={id}>
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-describedby={helpId}
        aria-invalid={error ? true : undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </Field>
  );
}

interface TextAreaProps extends Omit<TextInputProps, 'maxLength'> {
  rows?: number;
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  help,
  hint,
  error,
  optional,
  disabled,
  rows = 3,
}: TextAreaProps) {
  const id = useId();
  return (
    <Field label={label} help={help} hint={hint} error={error} optional={optional} htmlFor={id}>
      <textarea
        id={id}
        className="textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </Field>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: ReactNode;
  hint?: ReactNode;
  /** Text shown when the value is 0, e.g. "No limit". */
  zeroLabel?: string;
  disabled?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  help,
  hint,
  zeroLabel,
  disabled,
}: NumberInputProps) {
  const id = useId();
  const showZeroLabel = zeroLabel && value === 0;
  return (
    <Field label={label} help={help} hint={hint} htmlFor={id}>
      <div className="input-suffix-wrap">
        <input
          id={id}
          className="input input-number"
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value === '' ? 0 : Number(e.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
        {(suffix || showZeroLabel) && (
          <span className="input-suffix">{showZeroLabel ? zeroLabel : suffix}</span>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Select
 * ------------------------------------------------------------------ */

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  blurb?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  help?: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** Renders without the Field wrapper, for use inside tables/rows. */
  bare?: boolean;
  ariaLabel?: string;
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
  hint,
  placeholder = 'Choose…',
  disabled,
  bare,
  ariaLabel,
}: SelectProps<T>) {
  const id = useId();

  const trigger = (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RSelect.Trigger className="select-trigger" id={bare ? undefined : id} aria-label={ariaLabel ?? (bare ? label : undefined)}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="select-icon">
          <ChevronDown size={14} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="select-content" position="popper" sideOffset={4} collisionPadding={12}>
          <RSelect.ScrollUpButton className="select-scroll">
            <ChevronUp size={12} />
          </RSelect.ScrollUpButton>
          <RSelect.Viewport className="select-viewport">
            {options.map((opt) => (
              <RSelect.Item key={opt.value} value={opt.value} className="select-item" disabled={opt.disabled}>
                <RSelect.ItemText>
                  {opt.label}
                  {opt.blurb && <span className="select-item-blurb">{opt.blurb}</span>}
                </RSelect.ItemText>
                <RSelect.ItemIndicator style={{ marginLeft: 'auto' }}>
                  <Check size={14} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="select-scroll">
            <ChevronDown size={12} />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );

  if (bare) return trigger;

  return (
    <Field label={label} help={help} hint={hint} htmlFor={id}>
      {trigger}
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Toggle & checkbox
 * ------------------------------------------------------------------ */

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  blurb?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, blurb, disabled }: ToggleProps) {
  const id = useId();
  const blurbId = blurb ? `${id}-blurb` : undefined;
  return (
    <div className="switch-row">
      <RSwitch.Root
        id={id}
        className="switch"
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-describedby={blurbId}
      >
        <RSwitch.Thumb className="switch-thumb" />
      </RSwitch.Root>
      <span className="switch-text">
        <label className="switch-label" htmlFor={id}>
          {label}
        </label>
        {blurb && (
          <span className="switch-blurb" id={blurbId}>
            {blurb}
          </span>
        )}
      </span>
    </div>
  );
}

interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  blurb?: ReactNode;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, blurb, disabled }: CheckboxProps) {
  const id = useId();
  const blurbId = blurb ? `${id}-blurb` : undefined;
  return (
    <div className="checkbox-row">
      <RCheckbox.Root
        id={id}
        className="checkbox"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        aria-describedby={blurbId}
      >
        <RCheckbox.Indicator>
          <Check size={12} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <span className="switch-text">
        <label className="switch-label" htmlFor={id} style={{ fontWeight: 'var(--weight-normal)' }}>
          {label}
        </label>
        {blurb && (
          <span className="switch-blurb" id={blurbId}>
            {blurb}
          </span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented control
 * ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  /** Hides the visible label, keeping it for assistive tech. */
  hideLabel?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  hideLabel,
}: SegmentedProps<T>) {
  return (
    <div className="field" role="group" aria-label={label}>
      {!hideLabel && <span className="field-label">{label}</span>}
      <div className="segmented">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="segmented-item"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * List input — the workhorse for requirements, tools, flows, checks
 * ------------------------------------------------------------------ */

interface ListInputProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  help?: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  /** Renders values as inline chips instead of stacked rows. */
  compact?: boolean;
  /** Coerces entries to numbers, for viewport widths. */
  numeric?: boolean;
  emptyText?: string;
  suggestions?: string[];
}

export function ListInput({
  label,
  items,
  onChange,
  placeholder,
  help,
  hint,
  optional,
  compact,
  numeric,
  emptyText = 'Nothing added yet.',
  suggestions,
}: ListInputProps) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const commit = useCallback(() => {
    const value = draft.trim();
    if (!value) return;
    if (numeric && !Number.isFinite(Number(value))) return;
    if (items.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...items, value]);
    setDraft('');
  }, [draft, items, numeric, onChange]);

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Backspace' && draft === '' && items.length > 0) {
      e.preventDefault();
      remove(items.length - 1);
    }
  };

  const unusedSuggestions = (suggestions ?? []).filter((s) => !items.includes(s));

  return (
    <Field label={label} help={help} hint={hint} optional={optional} htmlFor={id}>
      <div className="taginput">
        {items.length > 0 ? (
          compact ? (
            <div className="chips">
              {items.map((item, i) => (
                <span key={`${item}-${i}`} className="chip">
                  {item}
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() => remove(i)}
                    aria-label={`Remove ${item}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <ul className="taginput-list">
              {items.map((item, i) => (
                <li key={`${item}-${i}`} className="taginput-item">
                  <span className="taginput-item-text">{item}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => remove(i)}
                    aria-label={`Remove "${item}"`}
                  >
                    <Trash size={13} />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="taginput-empty">{emptyText}</p>
        )}

        <div className="taginput-add">
          <input
            id={id}
            className="input"
            type={numeric ? 'number' : 'text'}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button variant="secondary" onClick={commit} disabled={draft.trim() === ''}>
            <Plus size={14} /> Add
          </Button>
        </div>

        {unusedSuggestions.length > 0 && (
          <div className="chips" style={{ marginTop: 'var(--space-1)' }}>
            <span className="text-xs text-tertiary" style={{ alignSelf: 'center' }}>
              Suggestions:
            </span>
            {unusedSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                style={{ cursor: 'pointer' }}
                onClick={() => onChange([...items, s])}
              >
                <Plus size={11} /> {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Callout
 * ------------------------------------------------------------------ */

type CalloutTone = 'info' | 'warn' | 'danger' | 'ok' | 'neutral';

const CALLOUT_ICONS: Record<CalloutTone, typeof Info> = {
  info: Info,
  warn: Warning,
  danger: AlertCircle,
  ok: CheckCircle,
  neutral: Lightbulb,
};

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
}) {
  const Icon = CALLOUT_ICONS[tone];
  return (
    <div className={`callout callout-${tone}`}>
      <span className="callout-icon">
        <Icon size={15} />
      </span>
      <div className="callout-body">
        {title && <span className="callout-title">{title}</span>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Accordion — progressive disclosure for advanced settings
 * ------------------------------------------------------------------ */

export function AdvancedSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <RAccordion.Root type="single" collapsible defaultValue={defaultOpen ? 'item' : undefined}>
      <RAccordion.Item value="item" className="accordion-item">
        <RAccordion.Header>
          <RAccordion.Trigger className="accordion-trigger">
            <ChevronRight size={14} className="accordion-chevron" />
            {title}
            {count && <span className="accordion-count">{count}</span>}
          </RAccordion.Trigger>
        </RAccordion.Header>
        <RAccordion.Content className="accordion-content">
          <div className="accordion-body stack">{children}</div>
        </RAccordion.Content>
      </RAccordion.Item>
    </RAccordion.Root>
  );
}

/* ------------------------------------------------------------------ *
 * Dialog
 * ------------------------------------------------------------------ */

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="dialog-overlay" />
        <RDialog.Content className={`dialog-content ${wide ? 'dialog-content-wide' : ''}`}>
          <RDialog.Title className="dialog-title">{title}</RDialog.Title>
          {description ? (
            <RDialog.Description className="dialog-description">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="visually-hidden">{title}</RDialog.Description>
          )}
          {children}
          {footer && <div className="dialog-footer">{footer}</div>}
          <RDialog.Close asChild>
            <button type="button" className="dialog-close" aria-label="Close">
              <X size={16} />
            </button>
          </RDialog.Close>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

export const Tabs = RTabs.Root;
export const TabsList = ({ children, label }: { children: ReactNode; label: string }) => (
  <RTabs.List className="tabs-list" aria-label={label}>
    {children}
  </RTabs.List>
);
export const TabsTrigger = ({ value, children }: { value: string; children: ReactNode }) => (
  <RTabs.Trigger value={value} className="tabs-trigger">
    {children}
  </RTabs.Trigger>
);
export const TabsContent = ({ value, children }: { value: string; children: ReactNode }) => (
  <RTabs.Content value={value} className="tabs-content" tabIndex={-1}>
    {children}
  </RTabs.Content>
);

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'accent' | 'danger' | 'warn' | 'ok';
  children: ReactNode;
}) {
  return <span className={`badge ${tone !== 'default' ? `badge-${tone}` : ''}`}>{children}</span>;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-title">{title}</span>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
