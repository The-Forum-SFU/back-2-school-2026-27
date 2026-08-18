/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PriceComparison from '../../src/components/PriceComparison'
import { EVENT, money, savedVersusTicket } from '../../src/config/event'
import type { Viewport } from '../../src/lib/viewport'

/**
 * The comparison block.
 *
 * event.test.ts already guards the source text of this file against hard-coded prices
 * and unloaded font weights. These are about what actually reaches the page: that every
 * figure on it is the one config says it should be, and that the closing sentence stops
 * claiming "half off" the moment the arithmetic behind it stops being true. That
 * sentence is the only assertion on the block that a price change can falsify without
 * changing any number shown next to it.
 */

const desktop: Viewport = {
  width: 1440,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  reducedMotion: false,
}

const p = EVENT.pricing

function renderBlock(props: Partial<{ vp: Viewport; variant: 'sell' | 'calm' }> = {}) {
  render(<PriceComparison vp={props.vp ?? desktop} variant={props.variant} />)
  return screen.getByRole('region', { name: 'What you pay' })
}

describe('the figures on it', () => {
  it('anchors against the all-in regular price', () => {
    expect(renderBlock()).toHaveTextContent(money(p.ticketAllInCents))
  })

  it('shows the guestlist rate and the saving that follows from it', () => {
    const block = renderBlock()
    expect(block).toHaveTextContent(money(p.doorEarlyCents))
    expect(block).toHaveTextContent(`Save ${money(savedVersusTicket(p.doorEarlyCents))}`)
  })

  it('shows the late rate', () => {
    expect(renderBlock()).toHaveTextContent(money(p.doorLateCents))
  })

  it('names the cutoff on both sides of it, from one config value', () => {
    const block = renderBlock()
    expect(block).toHaveTextContent(`Checked in before ${p.doorCutoff}`)
    expect(block).toHaveTextContent(`Checked in after ${p.doorCutoff}`)
  })
})

describe('the copy rule', () => {
  /*
    "Regular door entry", never "regular ticket". The guestlist spot is not a ticket and
    the door instructions on the confirmation page depend on people holding that
    distinction.
  */
  it('never calls the thing above the guestlist rate a ticket', () => {
    const block = renderBlock()
    expect(block.textContent).toMatch(/regular door entry/i)
    expect(block.textContent).not.toMatch(/ticket/i)
  })

  it('uses no em dashes', () => {
    expect(renderBlock().textContent).not.toMatch(/—/)
  })
})

describe('the "half off" claim', () => {
  it('is made while the late rate really is half the anchor', () => {
    // True of the shipping config, and the reason the sentence reads the way it does.
    expect(p.doorLateCents * 2).toBe(p.ticketAllInCents)
    expect(renderBlock()).toHaveTextContent('That is still half off!')
  })

  /**
   * The failure this guards. The TicketWeb fee inside `ticketAllInCents` is unconfirmed,
   * so the two sides of "half" can drift apart without anyone editing this component.
   * A hard-coded "half off" would keep asserting it against numbers that no longer
   * support it, right next to the numbers that disprove it.
   */
  it('falls back to the real percentage once that stops being true', async () => {
    vi.resetModules()
    vi.doMock('../../src/config/event', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/config/event')>()
      return {
        ...actual,
        EVENT: { ...actual.EVENT, pricing: { ...actual.EVENT.pricing, doorLateCents: 1000 } },
      }
    })

    const Block = (await import('../../src/components/PriceComparison')).default
    render(<Block vp={desktop} />)

    const block = screen.getByRole('region', { name: 'What you pay' })
    expect(block).not.toHaveTextContent('half off')
    expect(block).toHaveTextContent('That is still 67% off!')

    vi.doUnmock('../../src/config/event')
    vi.resetModules()
  })
})

describe('the two variants', () => {
  it('renders the same figures on the confirmation page', () => {
    const block = renderBlock({ variant: 'calm' })
    expect(block).toHaveTextContent(money(p.ticketAllInCents))
    expect(block).toHaveTextContent(money(p.doorEarlyCents))
    expect(block).toHaveTextContent(money(p.doorLateCents))
  })

  /*
    The accent is the whole difference. `sell` is arguing, so the saving is a filled red
    pill and the cutoff is red; `calm` is confirming a decision already made, so both
    drop to ink and the pill is outlined.
  */
  it('drops the accent to ink once the decision is made', () => {
    const { container } = render(<PriceComparison vp={desktop} variant="calm" />)
    expect(container.innerHTML).not.toContain('rgb(204, 6, 51)')
  })

  it('keeps the accent while it is still selling', () => {
    const { container } = render(<PriceComparison vp={desktop} />)
    expect(container.innerHTML).toContain('rgb(204, 6, 51)')
  })

  it('stacks the columns on mobile rather than letting them squeeze', () => {
    const mobile: Viewport = { ...desktop, width: 390, isMobile: true, isDesktop: false }
    const block = renderBlock({ vp: mobile })
    // The divider between the two prices turns from a vertical rule into a horizontal
    // one, which is the load-bearing half of the mobile layout.
    const row = within(block).getByText('Regular door entry').closest('div')?.parentElement
    expect(row?.style.borderRight).toBe('')
    expect(row?.style.borderBottom).not.toBe('')
  })
})
