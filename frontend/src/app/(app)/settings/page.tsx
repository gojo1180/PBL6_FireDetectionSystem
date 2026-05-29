"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity, Server, Plus, Pencil, Trash2, X, Loader2, MapPin, Wifi, WifiOff, Camera, Copy, Check, Settings2
} from "lucide-react";
import { getDevices, createDevice, updateDevice, deleteDevice } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Device } from "@/types";
import { TutorialTour, TourStep } from "@/components/ui/TutorialTour";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isTourActive, setIsTourActive] = useState(false);

  useEffect(() => {
    const isTourActiveStr = localStorage.getItem("bomba_tutorial_active");
    const tourPage = localStorage.getItem("bomba_tutorial_page");
    if (isTourActiveStr === "true" && tourPage === "settings") {
      setIsTourActive(true);
      localStorage.removeItem("bomba_tutorial_active");
      localStorage.removeItem("bomba_tutorial_page");
    }
  }, []);

  const handleTourComplete = () => {
    setIsTourActive(false);
    localStorage.setItem("bomba_tutorial_active", "true");
    localStorage.setItem("bomba_tutorial_page", "news");
    window.location.href = "/news";
  };

  const handleTourClose = () => {
    setIsTourActive(false);
    localStorage.removeItem("bomba_tutorial_active");
    localStorage.removeItem("bomba_tutorial_page");
  };

  const tourSteps: TourStep[] = [
    {
      targetId: "add-device-btn",
      title: "Tambah Perangkat Baru",
      description: "Klik tombol ini untuk mendaftarkan sensor fisik IoT baru atau kamera CCTV ke sistem Bomba AI.",
      type: "button",
    },
    {
      targetId: "tour-devices-section",
      title: "Daftar Perangkat dan Konfigurasi",
      description: "Semua perangkat IoT dan CCTV terdaftar ditampilkan di sini. Anda dapat menyalin ID perangkat untuk dipasang di ESP32 firmware, atau mengedit detail serta menghapus perangkat yang tidak aktif.",
      type: "section",
    },
    {
      targetId: "sidebar-link-news",
      title: "Halaman Berita Kebakaran",
      description: "Mari kita lanjut ke halaman Fire News untuk melihat kabar terbaru seputar insiden kebakaran yang dideteksi & dirangkum oleh AI.",
      type: "button",
    }
  ];

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
      const data = await getDevices();
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
      await createDevice({
        device_name: addForm.device_name,
        device_type: addForm.device_type,
        rtsp_url: addForm.rtsp_url || null,
        location: addForm.location || null,
        user_id: getUser()?.user_id || "00000000-0000-0000-0000-000000000000",
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
      await updateDevice(editDevice.id, {
        device_name: editForm.device_name || undefined,
        rtsp_url: editForm.rtsp_url || undefined,
        location: editForm.location || undefined,
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
      await deleteDevice(id);
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

  if (!mounted) return <div className="flex-1 min-h-screen bg-canvas" />;

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-200/40 bg-white/60 backdrop-blur-md flex items-center justify-between pl-16 lg:pl-6 pr-6 shrink-0 sticky top-0 z-20 shadow-[0_2px_8px_rgba(99,102,241,0.02)]">
        <div className="flex items-center gap-3 text-sm">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Settings2 size={18} className="text-indigo-500" />
          </div>
          <span className="font-bold text-base text-slate-800">Settings</span>
          <span className="text-slate-300 text-lg">/</span>
          <span className="text-slate-500">Device Management</span>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Connected Devices</h1>
            <p className="text-sm text-slate-500 mt-1">Manage sensors, cameras, and IoT hardware</p>
          </div>
          <button
            id="add-device-btn"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            <Plus size={16} />
            Add Device
          </button>
        </div>

        {/* Summary Stats */}
        {!loading && devices.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">Total Devices</p>
              <p className="text-2xl font-bold text-slate-800">{devices.length}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">Active</p>
              <p className="text-2xl font-bold text-emerald-600">{devices.filter(d => d.status === "active").length}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">Sensors</p>
              <p className="text-2xl font-bold text-teal-600">{devices.filter(d => d.device_type !== "CCTV").length}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">Cameras</p>
              <p className="text-2xl font-bold text-violet-600">{devices.filter(d => d.device_type === "CCTV").length}</p>
            </div>
          </div>
        )}

        {/* Devices Grid */}
        <div id="tour-devices-section">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/40 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-50/40 border border-slate-200/20 flex items-center justify-center mb-4">
                <Server size={28} className="text-slate-300" />
              </div>
              <p className="text-lg font-semibold text-slate-600">No Devices Found</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">Click &quot;Add Device&quot; to register your first hardware.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="group bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-slate-200/40 hover:border-indigo-200/80 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    {/* Device Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${d.device_type === "CCTV" ? "bg-violet-50 border border-violet-100" : "bg-teal-50 border border-teal-100"}`}>
                          {d.device_type === "CCTV" ? (
                            <Camera size={20} className="text-violet-500" />
                          ) : (
                            <Server size={20} className="text-teal-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{d.device_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">{d.device_type}</p>
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${d.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-500 border border-red-100"}`}>
                        {d.status === "active" ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {d.status}
                      </div>
                    </div>

                    {/* Location */}
                    {d.location && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        <MapPin size={12} className="text-indigo-400" />
                        {d.location}
                      </div>
                    )}

                    {/* Device ID */}
                    <div className="space-y-2">
                      <div className="px-3 py-2.5 rounded-xl bg-slate-50/40 border border-slate-200/20 flex items-center justify-between group/id hover:border-indigo-200/40 transition-colors">
                        <p className="text-[11px] text-slate-400 font-mono truncate" title={d.id}>ID: <span className="text-slate-600 font-semibold">{d.id.split("-")[0]}...</span></p>
                        <button
                          onClick={() => handleCopyId(d.id)}
                          className="text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center w-6 h-6 rounded-md hover:bg-indigo-50/60"
                          title="Copy complete Device ID"
                        >
                          {copiedId === d.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* RTSP URL */}
                    {d.rtsp_url && (
                      <div className="mt-2 px-3 py-2.5 rounded-xl bg-slate-50/40 border border-slate-200/20">
                        <p className="text-[11px] text-slate-400 font-mono truncate">{d.rtsp_url}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200/40">
                    <button
                      onClick={() => {
                        setEditDevice(d);
                        setEditForm({ device_name: d.device_name, rtsp_url: d.rtsp_url || "", location: d.location || "" });
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-50/60 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 hover:shadow-sm transition-all duration-200 border border-transparent hover:border-indigo-200/60"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50/60 text-red-500 text-xs font-semibold hover:bg-red-100 hover:shadow-sm transition-all duration-200 border border-transparent hover:border-red-200/60"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── ADD DEVICE MODAL ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50/60 flex items-center justify-center border border-indigo-100/40">
                  <Plus size={20} className="text-indigo-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Add New Device</h2>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50/60 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Name</label>
                <input required value={addForm.device_name} onChange={(e) => setAddForm({ ...addForm, device_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="e.g. CAM-01" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Type</label>
                <select value={addForm.device_type} onChange={(e) => setAddForm({ ...addForm, device_type: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all cursor-pointer">
                  <option value="SENSOR">Sensor</option>
                  <option value="CCTV">CCTV</option>
                </select>
              </div>

              {addForm.device_type === "CCTV" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RTSP URL <span className="text-slate-400">(optional)</span></label>
                  <input value={addForm.rtsp_url} onChange={(e) => setAddForm({ ...addForm, rtsp_url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="rtsp://..." />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location <span className="text-slate-400">(optional)</span></label>
                <input value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="e.g. Main Lobby" />
              </div>
              <button type="submit" disabled={addLoading} className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                {addLoading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add Device</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT DEVICE MODAL ─── */}
      {editDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50/60 flex items-center justify-center border border-indigo-100/40">
                  <Pencil size={18} className="text-indigo-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Edit Device</h2>
              </div>
              <button onClick={() => setEditDevice(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50/60 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Name</label>
                <input value={editForm.device_name} onChange={(e) => setEditForm({ ...editForm, device_name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
              </div>
              {editDevice.device_type === "CCTV" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RTSP URL</label>
                  <input value={editForm.rtsp_url} onChange={(e) => setEditForm({ ...editForm, rtsp_url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="rtsp://..." />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</label>
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="e.g. Server Room" />
              </div>
              <button type="submit" disabled={editLoading} className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                {editLoading ? <Loader2 size={16} className="animate-spin" /> : <><Pencil size={16} /> Save Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}
      <TutorialTour
        active={isTourActive}
        steps={tourSteps}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
      />
    </div>
  );
}
