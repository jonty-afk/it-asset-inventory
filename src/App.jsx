import { useEffect, useMemo, useState } from 'react'
import {
  DEVICE_TYPES, DEVICE_STATUSES, DEVICE_COLUMNS, LICENCE_COLUMNS, EMPTY_DEVICE, EMPTY_LICENCE,
  newId, todayString, daysUntil, dateStatus, validateDevice, validateLicence, seatsFree,
  filterDevices, filterLicences, sortBy, summary, toCSV, sampleData,
} from './inventory.js'

const KEY = 'it-asset-inventory:v1'

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (data && Array.isArray(data.devices) && Array.isArray(data.licences)) return data
  } catch { /* fall through */ }
  return { devices: [], licences: [] }
}

const input = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const btn = 'rounded px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500'
const btnPrimary = `${btn} bg-blue-700 text-white hover:bg-blue-800`
const btnPlain = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  )
}

function TextInput({ id, value, onChange, error, ...rest }) {
  return (
    <input
      id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}
      aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} {...rest}
    />
  )
}

const BADGE = {
  expired: 'bg-red-100 text-red-800',
  soon: 'bg-amber-100 text-amber-900',
  ok: 'bg-slate-100 text-slate-700',
}

function DateBadge({ date, today, expiredWord = 'Expired' }) {
  const st = dateStatus(date, today)
  if (st === 'none') return <span className="text-slate-400">-</span>
  const n = daysUntil(date, today)
  const note = st === 'expired' ? expiredWord : st === 'soon' ? (n === 0 ? 'Today' : `${n} day${n === 1 ? '' : 's'}`) : null
  return (
    <span className="whitespace-nowrap">
      {date}
      {note && <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[st]}`}>{note}</span>}
    </span>
  )
}

const STATUS_STYLE = {
  'In use': 'bg-green-100 text-green-800',
  Spare: 'bg-blue-100 text-blue-800',
  'In repair': 'bg-amber-100 text-amber-900',
  Retired: 'bg-slate-200 text-slate-700',
}

function SortHeader({ label, col, sort, setSort }) {
  const active = sort.key === col
  const next = active && sort.dir === 'asc' ? 'desc' : 'asc'
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left font-semibold">
      <button type="button" onClick={() => setSort({ key: col, dir: next })} className="inline-flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500">
        {label}
        <span aria-hidden="true" className="text-slate-400">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className={`rounded border p-3 ${warn && value > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  )
}

function DeviceForm({ initial, devices, onSave, onCancel }) {
  const [d, setD] = useState(initial)
  const [errors, setErrors] = useState({})
  const set = (k) => (v) => setD((p) => ({ ...p, [k]: v }))

  function submit(e) {
    e.preventDefault()
    const errs = validateDevice(d, devices)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`dev-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    onSave({ ...d, assetTag: d.assetTag.trim() })
  }

  return (
    <form onSubmit={submit} noValidate className="rounded border border-slate-200 bg-white p-4" aria-labelledby="device-form-title">
      <h2 id="device-form-title" className="mb-3 text-lg font-semibold">{initial.id ? `Edit ${initial.assetTag}` : 'Add a device'}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="dev-assetTag" label="Asset tag *" error={errors.assetTag}>
          <TextInput id="dev-assetTag" value={d.assetTag} onChange={set('assetTag')} error={errors.assetTag} placeholder="LT-003" />
        </Field>
        <Field id="dev-type" label="Type">
          <select id="dev-type" value={d.type} onChange={(e) => set('type')(e.target.value)} className={input}>
            {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="dev-status" label="Status">
          <select id="dev-status" value={d.status} onChange={(e) => set('status')(e.target.value)} className={input}>
            {DEVICE_STATUSES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="dev-model" label="Make and model">
          <TextInput id="dev-model" value={d.model} onChange={set('model')} />
        </Field>
        <Field id="dev-serial" label="Serial number">
          <TextInput id="dev-serial" value={d.serial} onChange={set('serial')} />
        </Field>
        <Field id="dev-assignedTo" label="Assigned to">
          <TextInput id="dev-assignedTo" value={d.assignedTo} onChange={set('assignedTo')} placeholder="Person or team" />
        </Field>
        <Field id="dev-location" label="Location">
          <TextInput id="dev-location" value={d.location} onChange={set('location')} />
        </Field>
        <Field id="dev-purchaseDate" label="Purchase date" error={errors.purchaseDate}>
          <TextInput id="dev-purchaseDate" type="date" value={d.purchaseDate} onChange={set('purchaseDate')} error={errors.purchaseDate} />
        </Field>
        <Field id="dev-warrantyEnd" label="Warranty ends" error={errors.warrantyEnd}>
          <TextInput id="dev-warrantyEnd" type="date" value={d.warrantyEnd} onChange={set('warrantyEnd')} error={errors.warrantyEnd} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field id="dev-notes" label="Notes">
            <textarea id="dev-notes" rows={2} value={d.notes} onChange={(e) => set('notes')(e.target.value)} className={input} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary}>{initial.id ? 'Save changes' : 'Add device'}</button>
        <button type="button" onClick={onCancel} className={btnPlain}>Cancel</button>
      </div>
    </form>
  )
}

function LicenceForm({ initial, onSave, onCancel }) {
  const [l, setL] = useState(initial)
  const [errors, setErrors] = useState({})
  const set = (k) => (v) => setL((p) => ({ ...p, [k]: v }))

  function submit(e) {
    e.preventDefault()
    const errs = validateLicence(l)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`lic-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    onSave({ ...l, software: l.software.trim(), seats: String(l.seats).trim(), seatsUsed: String(l.seatsUsed).trim() || '0' })
  }

  return (
    <form onSubmit={submit} noValidate className="rounded border border-slate-200 bg-white p-4" aria-labelledby="licence-form-title">
      <h2 id="licence-form-title" className="mb-3 text-lg font-semibold">{initial.id ? `Edit ${initial.software}` : 'Add a licence'}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="lic-software" label="Software *" error={errors.software}>
          <TextInput id="lic-software" value={l.software} onChange={set('software')} error={errors.software} />
        </Field>
        <Field id="lic-vendor" label="Vendor">
          <TextInput id="lic-vendor" value={l.vendor} onChange={set('vendor')} />
        </Field>
        <Field id="lic-renewalDate" label="Renewal date" error={errors.renewalDate}>
          <TextInput id="lic-renewalDate" type="date" value={l.renewalDate} onChange={set('renewalDate')} error={errors.renewalDate} />
        </Field>
        <Field id="lic-seats" label="Seats bought *" error={errors.seats}>
          <TextInput id="lic-seats" inputMode="numeric" value={l.seats} onChange={set('seats')} error={errors.seats} />
        </Field>
        <Field id="lic-seatsUsed" label="Seats used" error={errors.seatsUsed}>
          <TextInput id="lic-seatsUsed" inputMode="numeric" value={l.seatsUsed} onChange={set('seatsUsed')} error={errors.seatsUsed} />
        </Field>
        <Field id="lic-notes" label="Notes">
          <TextInput id="lic-notes" value={l.notes} onChange={set('notes')} />
        </Field>
      </div>
      <p className="mt-3 text-sm text-slate-600">Do not store licence keys here. The data is kept unencrypted in this browser.</p>
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary}>{initial.id ? 'Save changes' : 'Add licence'}</button>
        <button type="button" onClick={onCancel} className={btnPlain}>Cancel</button>
      </div>
    </form>
  )
}

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('devices')
  const [editing, setEditing] = useState(null) // record being added or edited
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [devSort, setDevSort] = useState({ key: 'assetTag', dir: 'asc' })
  const [licSort, setLicSort] = useState({ key: 'software', dir: 'asc' })
  const [message, setMessage] = useState('')
  const today = todayString()

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* storage unavailable */ }
  }, [data])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  const stats = useMemo(() => summary(data.devices, data.licences, today), [data, today])
  const devices = useMemo(
    () => sortBy(filterDevices(data.devices, { query, type: typeFilter, status: statusFilter }), devSort.key, devSort.dir),
    [data.devices, query, typeFilter, statusFilter, devSort],
  )
  const licences = useMemo(
    () => sortBy(filterLicences(data.licences, query), licSort.key, licSort.dir),
    [data.licences, query, licSort],
  )

  function switchTab(t) { setTab(t); setEditing(null) }

  function save(kind, record) {
    setData((p) => {
      const list = p[kind]
      const exists = list.some((r) => r.id === record.id)
      return { ...p, [kind]: exists ? list.map((r) => (r.id === record.id ? record : r)) : [...list, record] }
    })
    setMessage(`${kind === 'devices' ? record.assetTag : record.software} saved.`)
    setEditing(null)
  }

  function remove(kind, record) {
    const name = kind === 'devices' ? record.assetTag : record.software
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return
    setData((p) => ({ ...p, [kind]: p[kind].filter((r) => r.id !== record.id) }))
    if (editing?.id === record.id) setEditing(null)
    setMessage(`${name} deleted.`)
  }

  function exportCSV() {
    if (tab === 'devices') download(`devices-${today}.csv`, toCSV(devices, DEVICE_COLUMNS))
    else download(`licences-${today}.csv`, toCSV(licences, LICENCE_COLUMNS))
    setMessage(`Exported ${tab === 'devices' ? devices.length : licences.length} rows.`)
  }

  const shown = tab === 'devices' ? devices : licences
  const total = tab === 'devices' ? data.devices.length : data.licences.length
  const empty = data.devices.length === 0 && data.licences.length === 0

  const tabBtn = (t, label, count) => (
    <button
      type="button" role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} id={`tab-${t}`}
      onClick={() => switchTab(t)}
      className={`${btn} ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'}`}
    >
      {label} ({count})
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-semibold">IT Asset Inventory</h1>
          <p className="text-sm text-slate-600">Devices and software licences for a small office. Saved in this browser only.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Devices" value={stats.devices} />
          <Stat label="In use" value={stats.inUse} />
          <Stat label="Spare" value={stats.spare} />
          <Stat label="Warranty ends within 30 days" value={stats.warrantySoon} warn />
          <Stat label="Licences over-allocated" value={stats.overAllocated} warn />
          <Stat label="Licence renewals due or overdue" value={stats.renewalSoon} warn />
        </section>

        {empty && (
          <div className="rounded border border-dashed border-slate-300 bg-white p-4 text-sm">
            <p className="mb-2">Nothing recorded yet. Add a device below, or load a few example records to see how it works.</p>
            <button type="button" className={btnPlain} onClick={() => { setData(sampleData()); setMessage('Example records loaded.') }}>
              Load example records
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Inventory">
          {tabBtn('devices', 'Devices', data.devices.length)}
          {tabBtn('licences', 'Licences', data.licences.length)}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label htmlFor="search" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
              <input
                id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={input}
                placeholder={tab === 'devices' ? 'Tag, model, serial, person, location' : 'Software, vendor, notes'}
              />
            </div>
            {tab === 'devices' && (
              <>
                <div>
                  <label htmlFor="type-filter" className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                  <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={input}>
                    <option>All</option>
                    {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
                    <option>All</option>
                    {DEVICE_STATUSES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button" className={btnPrimary}
                onClick={() => setEditing(tab === 'devices' ? { ...EMPTY_DEVICE, id: '' } : { ...EMPTY_LICENCE, id: '' })}
              >
                {tab === 'devices' ? 'Add device' : 'Add licence'}
              </button>
              <button type="button" className={btnPlain} onClick={exportCSV} disabled={shown.length === 0}>
                Export CSV
              </button>
            </div>
          </div>

          {editing && tab === 'devices' && (
            <DeviceForm
              key={editing.id || 'new'} initial={editing} devices={data.devices}
              onSave={(d) => save('devices', { ...d, id: d.id || newId() })} onCancel={() => setEditing(null)}
            />
          )}
          {editing && tab === 'licences' && (
            <LicenceForm
              key={editing.id || 'new'} initial={editing}
              onSave={(l) => save('licences', { ...l, id: l.id || newId() })} onCancel={() => setEditing(null)}
            />
          )}

          <p className="text-sm text-slate-600">
            Showing {shown.length} of {total}. {shown.length < total && 'Export uses the filtered list.'}
          </p>

          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            {tab === 'devices' ? (
              <table className="min-w-full text-sm">
                <caption className="sr-only">Devices. Column headers are buttons that sort the table.</caption>
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <SortHeader label="Asset tag" col="assetTag" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Type" col="type" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Make and model" col="model" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Assigned to" col="assignedTo" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Location" col="location" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Status" col="status" sort={devSort} setSort={setDevSort} />
                    <SortHeader label="Warranty ends" col="warrantyEnd" sort={devSort} setSort={setDevSort} />
                    <th scope="col" className="px-3 py-2 text-left font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100 align-top">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {d.assetTag}
                        {d.serial && <div className="text-xs font-normal text-slate-500">S/N {d.serial}</div>}
                      </th>
                      <td className="px-3 py-2">{d.type}</td>
                      <td className="px-3 py-2">
                        {d.model || <span className="text-slate-400">-</span>}
                        {d.notes && <div className="max-w-xs text-xs text-slate-500">{d.notes}</div>}
                      </td>
                      <td className="px-3 py-2">{d.assignedTo || <span className="text-slate-400">-</span>}</td>
                      <td className="px-3 py-2">{d.location || <span className="text-slate-400">-</span>}</td>
                      <td className="px-3 py-2">
                        <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        {d.status === 'Retired' ? <span className="text-slate-400">{d.warrantyEnd || '-'}</span> : <DateBadge date={d.warrantyEnd} today={today} />}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" className="text-blue-700 hover:underline" onClick={() => setEditing(d)} aria-label={`Edit ${d.assetTag}`}>Edit</button>
                        <button type="button" className="ml-3 text-red-700 hover:underline" onClick={() => remove('devices', d)} aria-label={`Delete ${d.assetTag}`}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {devices.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No devices match.</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <caption className="sr-only">Licences. Column headers are buttons that sort the table.</caption>
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <SortHeader label="Software" col="software" sort={licSort} setSort={setLicSort} />
                    <SortHeader label="Vendor" col="vendor" sort={licSort} setSort={setLicSort} />
                    <SortHeader label="Seats" col="seats" sort={licSort} setSort={setLicSort} />
                    <SortHeader label="Used" col="seatsUsed" sort={licSort} setSort={setLicSort} />
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Free</th>
                    <SortHeader label="Renewal" col="renewalDate" sort={licSort} setSort={setLicSort} />
                    <th scope="col" className="px-3 py-2 text-left font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {licences.map((l) => {
                    const free = seatsFree(l)
                    return (
                      <tr key={l.id} className="border-t border-slate-100 align-top">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          {l.software}
                          {l.notes && <div className="text-xs font-normal text-slate-500">{l.notes}</div>}
                        </th>
                        <td className="px-3 py-2">{l.vendor || <span className="text-slate-400">-</span>}</td>
                        <td className="px-3 py-2">{l.seats}</td>
                        <td className="px-3 py-2">{l.seatsUsed || 0}</td>
                        <td className="px-3 py-2">
                          {free < 0
                            ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">{-free} over</span>
                            : free}
                        </td>
                        <td className="px-3 py-2"><DateBadge date={l.renewalDate} today={today} expiredWord="Overdue" /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button type="button" className="text-blue-700 hover:underline" onClick={() => setEditing(l)} aria-label={`Edit ${l.software}`}>Edit</button>
                          <button type="button" className="ml-3 text-red-700 hover:underline" onClick={() => remove('licences', l)} aria-label={`Delete ${l.software}`}>Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                  {licences.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No licences match.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-green-800">{message}</p>
      </main>
    </div>
  )
}
