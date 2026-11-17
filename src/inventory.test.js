import test from 'node:test'
import assert from 'node:assert/strict'
import {
  daysUntil, dateStatus, validateDevice, validateLicence, seatsFree, filterDevices,
  filterLicences, sortBy, summary, csvCell, toCSV, sampleData, EMPTY_DEVICE, DEVICE_COLUMNS,
} from './inventory.js'

const today = '2026-11-17'

test('daysUntil counts whole days and rejects bad dates', () => {
  assert.equal(daysUntil('2026-11-18', today), 1)
  assert.equal(daysUntil('2026-11-10', today), -7)
  assert.equal(daysUntil('2027-11-17', today), 365)
  assert.equal(daysUntil('', today), null)
  assert.equal(daysUntil('2026-02-30', today), null)
})

test('dateStatus groups dates into expired, soon, ok and none', () => {
  assert.equal(dateStatus('2026-11-16', today), 'expired')
  assert.equal(dateStatus('2026-11-17', today), 'soon')
  assert.equal(dateStatus('2026-12-17', today), 'soon')
  assert.equal(dateStatus('2026-12-18', today), 'ok')
  assert.equal(dateStatus('', today), 'none')
})

test('device needs an asset tag that is not already used', () => {
  const existing = [{ ...EMPTY_DEVICE, id: 'a', assetTag: 'LT-001' }]
  assert.ok(validateDevice({ ...EMPTY_DEVICE, assetTag: ' ' }).assetTag)
  assert.ok(validateDevice({ ...EMPTY_DEVICE, id: 'b', assetTag: 'lt-001' }, existing).assetTag)
  // Editing the same device keeps its own tag without an error.
  assert.deepEqual(validateDevice({ ...EMPTY_DEVICE, id: 'a', assetTag: 'LT-001' }, existing), {})
})

test('warranty cannot end before purchase', () => {
  const e = validateDevice({ ...EMPTY_DEVICE, assetTag: 'X', purchaseDate: '2025-01-10', warrantyEnd: '2024-01-10' })
  assert.match(e.warrantyEnd, /before the purchase date/)
})

test('licence validation checks name and seat numbers', () => {
  assert.deepEqual(validateLicence({ software: 'Office', seats: '5', seatsUsed: '' }), {})
  const e = validateLicence({ software: '', seats: '0', seatsUsed: '1.5' })
  assert.ok(e.software)
  assert.ok(e.seats)
  assert.ok(e.seatsUsed)
})

test('seatsFree goes negative when over-allocated', () => {
  assert.equal(seatsFree({ seats: '10', seatsUsed: '8' }), 2)
  assert.equal(seatsFree({ seats: '2', seatsUsed: '3' }), -1)
  assert.equal(seatsFree({ seats: '4', seatsUsed: '' }), 4)
})

test('filterDevices matches text, type and status', () => {
  const { devices } = sampleData()
  assert.equal(filterDevices(devices, { query: 'brother' }).length, 1)
  assert.equal(filterDevices(devices, { type: 'Laptop' }).length, 2)
  assert.equal(filterDevices(devices, { type: 'Laptop', status: 'Spare' }).length, 1)
  assert.equal(filterDevices(devices, { query: 'packing' })[0].assetTag, 'SC-004')
  assert.equal(filterDevices(devices).length, devices.length)
})

test('filterLicences searches name, vendor and notes', () => {
  const { licences } = sampleData()
  assert.equal(filterLicences(licences, 'adobe').length, 1)
  assert.equal(filterLicences(licences, '').length, 2)
})

test('sortBy handles numbers, text and blanks', () => {
  const rows = [{ v: '10' }, { v: '9' }, { v: '' }, { v: '100' }]
  assert.deepEqual(sortBy(rows, 'v').map((r) => r.v), ['9', '10', '100', ''])
  assert.deepEqual(sortBy(rows, 'v', 'desc').map((r) => r.v), ['100', '10', '9', ''])
  const tags = [{ t: 'LT-10' }, { t: 'LT-2' }, { t: 'lt-1' }]
  assert.deepEqual(sortBy(tags, 't').map((r) => r.t), ['lt-1', 'LT-2', 'LT-10'])
})

test('summary counts statuses, warranties and licence problems', () => {
  const { devices, licences } = sampleData()
  const s = summary(devices, licences, '2027-02-10')
  assert.equal(s.devices, 4)
  assert.equal(s.inUse, 2)
  assert.equal(s.spare, 1)
  assert.equal(s.inRepair, 1)
  assert.equal(s.warrantySoon, 1) // LT-001 ends 2027-03-01
  assert.equal(s.overAllocated, 1)
})

test('csvCell quotes and guards against spreadsheet formulas', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a, b'), '"a, b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvCell('-5'), "'-5")
  assert.equal(csvCell(undefined), '')
  assert.equal(csvCell(3), '3')
})

test('toCSV writes a header row and one line per record', () => {
  const csv = toCSV([{ ...EMPTY_DEVICE, assetTag: 'LT-1', notes: 'cracked, screen' }], DEVICE_COLUMNS)
  const lines = csv.trimEnd().split('\r\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^Asset tag,Type,/)
  assert.match(lines[1], /^LT-1,Laptop,/)
  assert.match(lines[1], /"cracked, screen"$/)
})
