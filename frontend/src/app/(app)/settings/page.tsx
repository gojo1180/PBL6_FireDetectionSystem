"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity, Server, Plus, Pencil, Trash2, X, Loader2, MapPin, Wifi, WifiOff, Camera, Copy, Check
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: string;
  rtsp_url: string | null;
  status: string;
  location: string | null;
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ device_name: "", device_type: "SENSOR", rtsp_url: "", location: "" });
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({ device_name: "", rtsp_url: "", location: "" });
  const [editLoading, setEditLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await apiFetch<Device[]>("/api/v1/devices/");
      setDevices(data);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchDevices();
  }, [fetchDevices]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await apiFetch("/api/v1/devices/", {
        method: "POST",
        body: {
          ...addForm,
          user_id: getUser()?.user_id || "00000000-0000-0000-0000-000000000000",
          rtsp_url: addForm.rtsp_url || null,
          location: addForm.location || null,
        },
      });
      setShowAdd(false);
      setAddForm({ device_name: "", device_type: "SENSOR", rtsp_url: "", location: "" });
      fetchDevices();
    } catch (err) {
      console.error("Add failed:", err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDevice) return;
    setEditLoading(true);
    try {
      await apiFetch(`/api/v1/devices/${editDevice.id}`, {
        method: "PUT",
        body: {
          device_name: editForm.device_name || undefined,
          rtsp_url: editForm.rtsp_url || undefined,
          location: editForm.location || undefined,
        },
      });
      setEditDevice(null);
      fetchDevices();
    } catch (err) {
      console.error("Edit failed:", err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    try {
      await apiFetch(`/api/v1/devices/${id}`, { method: "DELETE" });
      fetchDevices();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!mounted) return <div className="flex-1 min-h-screen bg-ctp-base" />;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar */}
      <header className="h-14 border-b border-ctp-crust bg-ctp-mantle flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-ctp-blue" />
          <span className="font-semibold text-ctp-text">Settings</span>
          <span className="text-ctp-overlay0">/</span>
          <span className="text-ctp-subtext0">Device Management</span>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ctp-text">Connected Devices</h1>
            <p className="text-sm text-ctp-subtext0 mt-1">Manage sensors, cameras, and IoT hardware</p>
          </div>
          <button
            id="add-device-btn"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all shadow-lg shadow-ctp-blue/25"
          >
            <Plus size={16} />
            Add Device
          </button>
        </div>

        {/* Devices Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-ctp-blue" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Server size={48} className="text-ctp-surface1 mb-4" />
            <p className="text-lg font-semibold text-ctp-subtext0">No Devices Found</p>
            <p className="text-sm text-ctp-overlay0 mt-1">Click &quot;Add Device&quot; to register your first hardware.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {devices.map((d) => (
              <div
                key={d.id}
                className="card p-5 rounded-2xl bg-ctp-mantle border border-ctp-crust hover:border-ctp-blue/20 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.device_type === "CCTV" ? "bg-ctp-peach/10" : "bg-ctp-teal/10"}`}>
                        {d.device_type === "CCTV" ? (
                          <Camera size={20} className="text-ctp-peach" />
                        ) : (
                          <Server size={20} className="text-ctp-teal" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-ctp-text text-sm">{d.device_name}</p>
                        <p className="text-[11px] text-ctp-overlay0 font-mono uppercase tracking-wider">{d.device_type}</p>
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${d.status === "active" ? "bg-ctp-green/10 text-ctp-green" : "bg-ctp-red/10 text-ctp-red"}`}>
                      {d.status === "active" ? <Wifi size={10} /> : <WifiOff size={10} />}
                      {d.status}
                    </div>
                  </div>

                  {d.location && (
                    <div className="flex items-center gap-2 text-xs text-ctp-subtext0 mb-2">
                      <MapPin size={12} className="text-ctp-lavender" />
                      {d.location}
                    </div>
                  )}

                  <div className="mt-2 flex flex-col gap-2">
                    <div className="px-3 py-2 rounded-lg bg-ctp-crust/50 border border-ctp-crust flex items-center justify-between group">
                      <p className="text-[10px] text-ctp-overlay0 font-mono truncate" title={d.id}>ID: <span className="text-ctp-text font-semibold">{d.id.split("-")[0]}...</span></p>
                      <button 
                        onClick={() => handleCopyId(d.id)}
                        className="text-ctp-subtext0 hover:text-ctp-blue transition-colors flex items-center justify-center w-5 h-5"
                        title="Copy complete Device ID"
                      >
                        {copiedId === d.id ? <Check size={12} className="text-ctp-green" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {d.rtsp_url && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-ctp-crust/50 border border-ctp-crust">
                      <p className="text-[10px] text-ctp-overlay0 font-mono truncate">{d.rtsp_url}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ctp-crust">
                  <button
                    onClick={() => {
                      setEditDevice(d);
                      setEditForm({ device_name: d.device_name, rtsp_url: d.rtsp_url || "", location: d.location || "" });
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ctp-blue/10 text-ctp-blue text-xs font-semibold hover:bg-ctp-blue/15 transition-colors"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-ctp-red/10 text-ctp-red text-xs font-semibold hover:bg-ctp-red/15 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── ADD DEVICE MODAL ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-ctp-mantle border border-ctp-crust shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ctp-text">Add New Device</h2>
              <button onClick={() => setShowAdd(false)} className="text-ctp-overlay0 hover:text-ctp-text">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Device Name</label>
                <input required value={addForm.device_name} onChange={(e) => setAddForm({ ...addForm, device_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" placeholder="e.g. CAM-01" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Device Type</label>
                <select value={addForm.device_type} onChange={(e) => setAddForm({ ...addForm, device_type: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all">
                  <option value="SENSOR">Sensor</option>
                  <option value="CCTV">CCTV</option>
                </select>
              </div>
              
              {addForm.device_type === "CCTV" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">RTSP URL <span className="text-ctp-overlay0">(optional)</span></label>
                  <input value={addForm.rtsp_url} onChange={(e) => setAddForm({ ...addForm, rtsp_url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" placeholder="rtsp://..." />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Location <span className="text-ctp-overlay0">(optional)</span></label>
                <input value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" placeholder="e.g. Main Lobby" />
              </div>
              <button type="submit" disabled={addLoading} className="w-full py-3 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all shadow-lg shadow-ctp-blue/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {addLoading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add Device</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT DEVICE MODAL ─── */}
      {editDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-ctp-mantle border border-ctp-crust shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ctp-text">Edit Device</h2>
              <button onClick={() => setEditDevice(null)} className="text-ctp-overlay0 hover:text-ctp-text">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Device Name</label>
                <input value={editForm.device_name} onChange={(e) => setEditForm({ ...editForm, device_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" />
              </div>
              {editDevice.device_type === "CCTV" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">RTSP URL</label>
                  <input value={editForm.rtsp_url} onChange={(e) => setEditForm({ ...editForm, rtsp_url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" placeholder="rtsp://..." />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider">Location</label>
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ctp-base border border-ctp-crust text-ctp-text text-sm placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/40 transition-all" placeholder="e.g. Server Room" />
              </div>
              <button type="submit" disabled={editLoading} className="w-full py-3 rounded-xl bg-ctp-blue text-white font-semibold text-sm hover:bg-ctp-sapphire transition-all shadow-lg shadow-ctp-blue/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {editLoading ? <Loader2 size={16} className="animate-spin" /> : <><Pencil size={16} /> Save Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
