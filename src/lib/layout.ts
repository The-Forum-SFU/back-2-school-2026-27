/**
 * Scatter `count` images across a `cols`-wide grid.
 *
 * Each row gets one image at a marching primary column; every third row gets a
 * second image two columns over. Cells with no image are `-1` and render as
 * empty spacers, which is what gives the grid its staggered, off-beat rhythm.
 */
export function buildLayout(count: number, cols: number): number[][] {
  const rows: number[][] = []
  let next = 0

  for (let r = 0; next < count; r++) {
    const row: number[] = new Array(cols).fill(-1)

    const a = (r * 2 + (r % 2)) % cols
    row[a] = next++

    if (r % 3 === 0 && next < count) {
      let b = (a + 2) % cols
      if (b === a) b = (a + 1) % cols
      row[b] = next++
    }

    rows.push(row)
  }

  return rows
}
