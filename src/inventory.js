// Plain functions for the inventory: no React here, so they can be tested with node --test.

export const DEVICE_TYPES = ['Laptop', 'Desktop', 'Phone', 'Tablet', 'Monitor', 'Printer', 'Scanner', 'Network', 'Other']
export const DEVICE_STATUSES = ['In use', 'Spare', 'In repair', 'Retired']

export const DEVICE_COLUMNS = [
  ['assetTag', 'Asset tag'],
  ['type', 'Type'],
  ['model', 'Make and model'],
  ['serial', 'Serial number'],
  ['assignedTo', 'Assigned to'],
  ['location', 'Location'],
  ['status', 'Status'],
  ['purchaseDate', 'Purchase date'],
  ['warrantyEnd', 'Warranty ends'],
  ['notes', 'Notes'],
]

export const LICENCE_COLUMNS = [
  ['software', 'Software'],
  ['vendor', 'Vendor'],
  ['seats', 'Seats'],
  ['seatsUsed', 'Seats used'],
  ['renewalDate', 'Renewal date'],
  ['notes', 'Notes'],
]

export const EMPTY_DEVICE = {
  assetTag: '', type: 'Laptop', model: '', serial: '', assignedTo: '', location: '',
  status: 'In use', purchaseDate: '', warrantyEnd: '', notes: '',
}

export const EMPTY_LICENCE = {
  software: '', vendor: '', seats: '', seatsUsed: '', renewalDate: '', notes: '',
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// Dates are stored as YYYY-MM-DD strings from <input type="date">.
// Parse them as UTC so a time zone never shifts the day.
function parseDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null
  const [y, m, d] = s.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const check = new Date(t)
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return t
}

export function todayString(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysUntil(date, today) {
  const a = parseDay(date)
  const b = parseDay(today)
  if (a === null || b === null) return null
  return Math.round((a - b) / 86400000)
}

// 'none' (no date), 'expired', 'soon' (within soonDays), or 'ok'.
export function dateStatus(date, today, soonDays = 30) {
  const n = daysUntil(date, today)
  if (n === null) return 'none'
  if (n < 0) return 'expired'
  if (n <= soonDays) return 'soon'
  return 'ok'
}

export function validateDevice(d, existing = []) {
  const errors = {}
  const tag = (d.assetTag || '').trim()
  if (!tag) errors.assetTag = 'Asset tag is required.'
  else if (existing.some((e) => e.id !== d.id && e.assetTag.trim().toLowerCase() === tag.toLowerCase())) {
    errors.assetTag = 'Another device already uses this asset tag.'
  }
  if (!DEVICE_TYPES.includes(d.type)) errors.type = 'Choose a device type.'
  if (!DEVICE_STATUSES.includes(d.status)) errors.status = 'Choose a status.'
  if (d.purchaseDate && parseDay(d.purchaseDate) === null) errors.purchaseDate = 'Use a valid date.'
  if (d.warrantyEnd && parseDay(d.warrantyEnd) === null) errors.warrantyEnd = 'Use a valid date.'
  if (!errors.purchaseDate && !errors.warrantyEnd && d.purchaseDate && d.warrantyEnd &&
      daysUntil(d.warrantyEnd, d.purchaseDate) < 0) {
    errors.warrantyEnd = 'Warranty end is before the purchase date.'
  }
  return errors
}

function wholeNumber(v) {
  const s = String(v ?? '').trim()
  return /^\d+$/.test(s) ? Number(s) : null
}

export function validateLicence(l) {
  const errors = {}
  if (!(l.software || '').trim()) errors.software = 'Software name is required.'
  const seats = wholeNumber(l.seats)
  if (seats === null || seats < 1) errors.seats = 'Seats must be a whole number of 1 or more.'
  const used = String(l.seatsUsed ?? '').trim() === '' ? 0 : wholeNumber(l.seatsUsed)
  if (used === null) errors.seatsUsed = 'Seats used must be a whole number.'
  if (l.renewalDate && parseDay(l.renewalDate) === null) errors.renewalDate = 'Use a valid date.'
  return errors
}

// Free seats; negative means more installs than the licence covers.
export function seatsFree(l) {
  return (wholeNumber(l.seats) ?? 0) - (wholeNumber(l.seatsUsed) ?? 0)
}

export function filterDevices(devices, { query = '', type = 'All', status = 'All' } = {}) {
  const q = query.trim().toLowerCase()
  return devices.filter((d) => {
    if (type !== 'All' && d.type !== type) return false
    if (status !== 'All' && d.status !== status) return false
    if (!q) return true
    return [d.assetTag, d.model, d.serial, d.assignedTo, d.location, d.notes]
      .some((v) => (v || '').toLowerCase().includes(q))
  })
}

export function filterLicences(licences, query = '') {
  const q = query.trim().toLowerCase()
  if (!q) return licences
  return licences.filter((l) => [l.software, l.vendor, l.notes].some((v) => (v || '').toLowerCase().includes(q)))
}

export function sortBy(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = a[key] ?? ''
    const y = b[key] ?? ''
    const nx = Number(x)
    const ny = Number(y)
    if (x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * sign
    // Empty values always go last, whichever direction.
    if (x === '' && y !== '') return 1
    if (y === '' && x !== '') return -1
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * sign
  })
}

export function summary(devices, licences, today) {
  return {
    devices: devices.length,
    inUse: devices.filter((d) => d.status === 'In use').length,
    spare: devices.filter((d) => d.status === 'Spare').length,
    inRepair: devices.filter((d) => d.status === 'In repair').length,
    warrantySoon: devices.filter((d) => d.status !== 'Retired' && dateStatus(d.warrantyEnd, today) === 'soon').length,
    licences: licences.length,
    overAllocated: licences.filter((l) => seatsFree(l) < 0).length,
    renewalSoon: licences.filter((l) => ['soon', 'expired'].includes(dateStatus(l.renewalDate, today))).length,
  }
}

// One CSV cell. Quotes values with commas, quotes or line breaks, and puts a
// leading apostrophe on values that a spreadsheet would treat as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function toCSV(rows, columns) {
  const lines = [columns.map(([, label]) => csvCell(label)).join(',')]
  for (const row of rows) lines.push(columns.map(([key]) => csvCell(row[key])).join(','))
  return lines.join('\r\n') + '\r\n'
}

// Example records so the app is not empty on first open. Clearly fictional.
export function sampleData() {
  const d = (o) => ({ ...EMPTY_DEVICE, id: newId(), ...o })
  const l = (o) => ({ ...EMPTY_LICENCE, id: newId(), ...o })
  return {
    devices: [
      d({ assetTag: 'LT-001', type: 'Laptop', model: 'Dell Latitude 5440', serial: 'EXAMPLE-1001', assignedTo: 'Front desk', location: 'Office', status: 'In use', purchaseDate: '2024-03-01', warrantyEnd: '2027-03-01' }),
      d({ assetTag: 'LT-002', type: 'Laptop', model: 'MacBook Air M2', serial: 'EXAMPLE-1002', assignedTo: '', location: 'Storage cupboard', status: 'Spare', purchaseDate: '2023-06-15', warrantyEnd: '2024-06-15' }),
      d({ assetTag: 'PR-001', type: 'Printer', model: 'Brother HL-L2350DW', serial: 'EXAMPLE-2001', location: 'Back office', status: 'In repair', notes: 'Paper jam sensor fault, sent for repair' }),
      d({ assetTag: 'SC-004', type: 'Scanner', model: 'Zebra TC52 handheld', serial: 'EXAMPLE-3004', assignedTo: 'Packing team', location: 'Dispatch', status: 'In use' }),
    ],
    licences: [
      l({ software: 'Microsoft 365 Business Standard', vendor: 'Microsoft', seats: '10', seatsUsed: '8' }),
      l({ software: 'Adobe Acrobat Pro', vendor: 'Adobe', seats: '2', seatsUsed: '3', notes: 'One install to remove' }),
    ],
  }
}
