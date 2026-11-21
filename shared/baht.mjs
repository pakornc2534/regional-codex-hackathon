const formatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  trailingZeroDisplay: 'stripIfInteger',
})

/** @param {number} value */
export function bahtAmount(value) {
  return formatter.format(value)
}
