import { ErrorText, FIELD_RULE, ERROR, controlStyle, labelStyle } from './Field'

/**
 * Date of birth as three selects.
 *
 * Not <input type="date">: native pickers open on the current year and make a 2006
 * birthday a decade of scrolling on mobile, and their rendering is unstyleable and
 * inconsistent across browsers — which fights a monochrome page. Three selects are
 * deterministic, styleable, and fast to fill.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Only years that could plausibly be 19+ at the door, newest first. */
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - 17 - i)

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

type Props = {
  year: string
  month: string
  day: string
  error?: string
  onChange: (part: 'dobYear' | 'dobMonth' | 'dobDay', value: string) => void
  onBlur: () => void
}

const selectStyle = {
  ...controlStyle,
  cursor: 'pointer',
  // Safari ignores the shared reset on selects without this.
  appearance: 'none' as const,
}

export function DobField({ year, month, day, error, onChange, onBlur }: Props) {
  const errorId = 'dob-error'
  const borderBottomColor = error ? ERROR : FIELD_RULE

  return (
    <div style={{ marginBottom: 22 }}>
      {/* A fieldset legend would be more correct, but legend styling is famously
          inconsistent; this group is labelled via aria-labelledby instead. */}
      <span id="dob-label" style={labelStyle}>
        Date of birth
      </span>
      <div
        role="group"
        aria-labelledby="dob-label"
        aria-describedby={error ? errorId : undefined}
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.1fr', gap: 12 }}
      >
        <select
          aria-label="Birth month"
          autoComplete="bday-month"
          value={month}
          onChange={(e) => onChange('dobMonth', e.target.value)}
          onBlur={onBlur}
          style={{ ...selectStyle, borderBottomColor }}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="Birth day"
          autoComplete="bday-day"
          value={day}
          onChange={(e) => onChange('dobDay', e.target.value)}
          onBlur={onBlur}
          style={{ ...selectStyle, borderBottomColor }}
        >
          <option value="">Day</option>
          {DAYS.map((d) => (
            <option key={d} value={String(d)}>
              {d}
            </option>
          ))}
        </select>

        <select
          aria-label="Birth year"
          autoComplete="bday-year"
          value={year}
          onChange={(e) => onChange('dobYear', e.target.value)}
          onBlur={onBlur}
          style={{ ...selectStyle, borderBottomColor }}
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  )
}
