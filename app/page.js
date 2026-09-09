'use client'
import { useEffect, useState } from 'react'

const STORES = ['TSS', 'TS', 'TSW']
const emptyForm = { name: '', empId: '', mobile: '', licence: '', licenceExpiry: '', status: 'Active', assignedLocation: '', remarks: '' }

export default function DriverMasterPage() {
  const [drivers, setDrivers] = useState([])
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
  const isAdmin = user.role === 'admin'

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-user-role': user.role || '',
    'x-store-id': user.storeId || '',
  }

  const loadDrivers = () => {
    fetch('/api/drivers', { headers: authHeaders })
      .then(res => res.json())
      .then(setDrivers)
  }

  useEffect(() => { loadDrivers() }, [])

  const filtered = drivers.filter(d => {
    const matchesSearch =
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.empId?.toLowerCase().includes(search.toLowerCase())
    const matchesStore = storeFilter ? d.assignedLocation === storeFilter : true
    return matchesSearch && matchesStore
  })

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (driver) => {
    setForm({
      name: driver.name || '',
      empId: driver.empId || '',
      mobile: driver.mobile || '',
      licence: driver.licence || '',
      licenceExpiry: driver.licenceExpiry ? driver.licenceExpiry.slice(0, 10) : '',
      status: driver.status || 'Active',
      assignedLocation: driver.assignedLocation || '',
      remarks: driver.remarks || '',
    })
    setEditingId(driver.id)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.assignedLocation) {
      alert('Name and Assigned Store are required')
      return
    }

    if (editingId) {
      await fetch(`/api/drivers/${editingId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/drivers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      })
    }

    setModalOpen(false)
    loadDrivers()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this driver?')) return
    await fetch(`/api/drivers/${id}`, { method: 'DELETE', headers: authHeaders })
    loadDrivers()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Driver Master</h1>
          <p className="text-gray-500">Manage drivers</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="bg-red-800 text-white px-4 py-2 rounded">
            + Add Driver
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search driver..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        {isAdmin && (
          <select
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Stores</option>
            {STORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2">Name</th>
            <th>Employee ID</th>
            <th>Mobile</th>
            <th>Licence Number</th>
            <th>Licence Expiry</th>
            <th>Assigned Store</th>
            <th>Status</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map(d => (
            <tr key={d.id} className="border-b">
              <td className="py-2 font-medium">{d.name}</td>
              <td>{d.empId}</td>
              <td>{d.mobile}</td>
              <td>{d.licence}</td>
              <td>{d.licenceExpiry ? new Date(d.licenceExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td>{d.assignedLocation || '-'}</td>
              <td>
                <span className={`px-2 py-1 rounded text-white text-xs ${d.status === 'Active' ? 'bg-red-900' : 'bg-gray-400'}`}>
                  {d.status}
                </span>
              </td>
              {isAdmin && (
                <td className="space-x-2">
                  <button onClick={() => openEdit(d)} className="border px-3 py-1 rounded">Edit</button>
                  <button onClick={() => handleDelete(d.id)} className="bg-red-800 text-white px-3 py-1 rounded">Delete</button>
                </td>
              )}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={8} className="text-center py-6 text-gray-400">No drivers found</td></tr>
          )}
        </tbody>
      </table>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Driver' : 'Add Driver'}</h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <label className="block mb-1">Name</label>
            <input
              className="border rounded w-full px-3 py-2 mb-3"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block mb-1">Employee ID</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.empId}
                  onChange={e => setForm({ ...form, empId: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Mobile</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block mb-1">Licence Number</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={form.licence}
                  onChange={e => setForm({ ...form, licence: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Licence Expiry</label>
                <input
                  type="date"
                  className="border rounded w-full px-3 py-2"
                  value={form.licenceExpiry}
                  onChange={e => setForm({ ...form, licenceExpiry: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block mb-1">Status</label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block mb-1">Assigned Store</label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={form.assignedLocation}
                  onChange={e => setForm({ ...form, assignedLocation: e.target.value })}
                >
                  <option value="">Select Store</option>
                  {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="block mb-1">Remarks</label>
            <textarea
              className="border rounded w-full px-3 py-2 mb-4"
              value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })}
            />

            <div className="text-right">
              <button onClick={handleSave} className="bg-red-800 text-white px-6 py-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
