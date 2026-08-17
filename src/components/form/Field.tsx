import type { InputHTMLAttributes, ReactNode } from 'react'
import { FONT } from '../../assets'

/**
 * Form primitives for the signup surface.
 *
 * White ground, black text, Inter Tight 500 with the site's -0.04em tracking — this
 * continues the outro's terminal frame rather than introducing a second palette.
 * Borders are a single hairline rule under each field, which is why these are inputs
 * with `borderBottom` rather than boxes.
 */

export const INK = '#000'
/**
 * Secondary text. Not lighter than this: at 0.45 the fine print sat at roughly the
 * same weight as the sheet's printed blue rules, and a rule crossing a line of 12px
 * grey reads as a strikethrough. Quiet enough to recede, dark enough to win.
 */
export const MUTED = 'rgba(0,0,0,0.58)'
/** Hairline for borders on plain white — the comparison cards. */
export const RULE = 'rgba(0,0,0,0.25)'
/**
 * Field underlines specifically. Stronger than RULE because these sit on ruled
 * notebook paper: at 0.25 they land at roughly the weight of the sheet's own printed
 * blue lines, and the fields stop reading as fields. Since a resting field has no
 * background of its own, this contrast is the only thing separating the two.
 */
export const FIELD_RULE = 'rgba(0,0,0,0.55)'
export const ERROR = '#c81e1e'
/**
 * Lighter than RULE, for rules INSIDE a block that is already bounded by one.
 * At 0.25 every internal divider carries the same weight as the block's own edges and
 * the thing stops having a structure.
 */
export const HAIRLINE = 'rgba(0,0,0,0.16)'
/**
 * The sheet's own red margin rule, at full strength.
 *
 * `--margin-ink` in index.css prints that rule at 0.3 alpha; this is the same hue used
 * as the one accent on the page. Deliberately NOT ERROR, which is a different red doing
 * a different job: a saving is not a problem, and the two must not be confusable. Using
 * the paper's red is what keeps the price block reading as part of the sheet instead of
 * introducing a second palette.
 */
export const MARGIN_RED = '#c95858'

export const labelStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: '-0.02em',
  textTransform: 'uppercase' as const,
  // Darker than MUTED: 11px uppercase at 0.45 disappears into the paper's creases.
  color: 'rgba(0,0,0,0.62)',
  display: 'block',
  marginBottom: 6,
  // Matches the control's inset below, so label and field text share a left edge.
  paddingLeft: 10,
}

export const controlStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  color: INK,
  // No `background` here on purpose. A resting field shows the ruled sheet straight
  // through; the focus tint that lifts what someone is typing off the rules is set in
  // index.css under `.paper-surface`, and an inline value — even `transparent` —
  // would win over it.
  border: 'none',
  borderBottom: `1px solid ${FIELD_RULE}`,
  borderRadius: 0,
  // Horizontal inset so text isn't jammed against the edge of that ground.
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
  // iOS zooms the viewport when a focused input is under 16px. Non-negotiable.
  fontSize: 16,
}

/**
 * Always-visible guidance under a field. Quiet, and deliberately not red — this is
 * what someone reads before they type, so it must not look like something has already
 * gone wrong.
 */
export function HintText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span
      id={id}
      style={{
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 11,
        lineHeight: '140%',
        letterSpacing: '-0.02em',
        color: MUTED,
        display: 'block',
        marginTop: 6,
      }}
    >
      {children}
    </span>
  )
}

export function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span
      id={id}
      style={{
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: '-0.02em',
        color: ERROR,
        display: 'block',
        marginTop: 6,
      }}
    >
      {children}
    </span>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  /** Persistent guidance under the input. Shown whether or not there is an error. */
  hint?: string
  error?: string
}

export function Field({ id, label, hint, error, ...input }: FieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // Both, when both exist: the hint is the reason the field is fussy and stays useful
  // once the error appears, so a screen reader gets the rule and the complaint.
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ')

  return (
    <div style={{ marginBottom: 22 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        style={{
          ...controlStyle,
          borderBottomColor: error ? ERROR : FIELD_RULE,
        }}
      />
      {/* Hint first so it holds a fixed position: an error appears and disappears on
          every blur, and anchoring the permanent line to the field keeps the block
          from shifting under the reader each time. */}
      {hint && <HintText id={hintId}>{hint}</HintText>}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  )
}

type CheckboxProps = {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  children: ReactNode
}

/**
 * A real <input type="checkbox"> with a real <label>, not a styled div — it has to be
 * keyboard-reachable and announced by screen readers. `accentColor` gets the native
 * control most of the way to the monochrome palette without replacing it.
 */
export function Checkbox({ id, checked, onChange, error, children }: CheckboxProps) {
  const errorId = `${id}-error`
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{
            width: 16,
            height: 16,
            marginTop: 2,
            accentColor: INK,
            flexShrink: 0,
            cursor: 'pointer',
          }}
        />
        <label
          htmlFor={id}
          style={{
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 12,
            lineHeight: '140%',
            letterSpacing: '-0.02em',
            color: INK,
            cursor: 'pointer',
          }}
        >
          {children}
        </label>
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  )
}
