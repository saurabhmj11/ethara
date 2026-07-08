"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Floor, Bay, Seat, Employee } from "@/types";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/Loading";
import { cn } from "@/lib/utils";

export default function SeatsPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [bays, setBays] = useState<Bay[]>([]);
  const [seatsByBay, setSeatsByBay] = useState<Record<number, Seat[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [onboardingEmployees, setOnboardingEmployees] = useState<Employee[]>([]);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  useEffect(() => {
    api.listFloors().then((f) => {
      setFloors(f);
      if (f.length > 0) setSelectedFloor(f[0].id);
    }).catch(() => {});
  }, []);

  const loadFloor = useCallback(async () => {
    if (!selectedFloor) return;
    setLoading(true);
    setMessage(null);
    try {
      const baysResp = await api.listBays(selectedFloor);
      setBays(baysResp);
      const seatsResp = await api.listSeats({ floor_id: selectedFloor, limit: 1000 });
      const grouped: Record<number, Seat[]> = {};
      seatsResp.items.forEach((s: Seat) => {
        if (!grouped[s.bay_id]) grouped[s.bay_id] = [];
        grouped[s.bay_id].push(s);
      });
      Object.keys(grouped).forEach((k) => {
        grouped[Number(k)].sort((a, b) => a.seat_number.localeCompare(b.seat_number));
      });
      setSeatsByBay(grouped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedFloor]);

  useEffect(() => { loadFloor(); }, [loadFloor]);

  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat(seat);
    setMessage(null);
    if (seat.status === "AVAILABLE") {
      api.listEmployees({ status: "ONBOARDING", limit: 100, has_seat: false })
        .then((r) => setOnboardingEmployees(r.items))
        .catch(() => setOnboardingEmployees([]));
    }
  };

  const handleRelease = async (seatId: number) => {
    setAllocating(true);
    setMessage(null);
    try {
      const r = await api.releaseSeat(seatId);
      setMessage({ type: "success", text: r.message });
      setSelectedSeat(null);
      await loadFloor();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setAllocating(false);
    }
  };

  const handleAllocate = async (seatId: number, employeeId: number) => {
    setAllocating(true);
    setMessage(null);
    try {
      const r = await api.allocateSeat(employeeId, seatId);
      setMessage({ type: "success", text: r.message });
      setSelectedSeat(null);
      await loadFloor();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setAllocating(false);
    }
  };

  const selectedFloorObj = floors.find((f) => f.id === selectedFloor);
  const totalSeatsOnFloor = selectedFloorObj?.seat_count ?? 0;
  const occupiedOnFloor = selectedFloorObj?.occupied_count ?? 0;
  const floorUtil = totalSeatsOnFloor > 0 ? Math.round((occupiedOnFloor / totalSeatsOnFloor) * 100) : 0;

  return (
    <div className="space-y-5 fade-in">
      <PageHeader
        title="Seat Map"
        description="Interactive floor plan — click any seat to allocate or release."
        badge={<span className="badge badge-violet">Interactive</span>}
      />

      {/* Floor selector with stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {floors.map((f) => {
          const util = f.seat_count ? Math.round((f.occupied_count! / f.seat_count!) * 100) : 0;
          const active = selectedFloor === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFloor(f.id)}
              className={cn(
                "card card-hover text-left p-4 transition-all",
                active && "ring-2 ring-indigo-500 border-indigo-500"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900">{f.name}</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  util > 80 ? "bg-rose-100 text-rose-700" :
                  util > 60 ? "bg-amber-100 text-amber-700" :
                  "bg-emerald-100 text-emerald-700"
                )}>{util}%</span>
              </div>
              <div className="text-xs text-slate-500 mb-2">
                {f.occupied_count} / {f.seat_count} seats occupied
              </div>
              <div className="progress" style={{ height: 4 }}>
                <div
                  className={cn(
                    "progress-bar",
                    util > 80 ? "bg-rose-500" : util > 60 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${util}%` }}
                ></div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend + floor info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="seat seat-occupied" style={{ width: 16, height: 16 }} /> Occupied
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="seat seat-available" style={{ width: 16, height: 16 }} /> Available
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="seat seat-reserved" style={{ width: 16, height: 16 }} /> Reserved
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="seat seat-maintenance" style={{ width: 16, height: 16 }} /> Maintenance
          </span>
        </div>
        {selectedFloorObj && (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold">{selectedFloorObj.name}</span>
            <span className="text-slate-400">·</span>
            <span>{occupiedOnFloor} occupied</span>
            <span className="text-slate-400">·</span>
            <span>{totalSeatsOnFloor - occupiedOnFloor} available</span>
            <span className="text-slate-400">·</span>
            <span className="font-bold text-indigo-600">{floorUtil}% utilized</span>
          </div>
        )}
      </div>

      {/* Toast message */}
      {message && (
        <div className={cn(
          "card py-3 flex items-center gap-3 fade-in",
          message.type === "success" ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
        )}>
          <span className="text-xl">{message.type === "success" ? "✓" : "✕"}</span>
          <p className={cn("text-sm font-medium flex-1", message.type === "success" ? "text-emerald-700" : "text-rose-700")}>
            {message.text}
          </p>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700">×</button>
        </div>
      )}

      {/* Seat map */}
      {loading ? (
        <LoadingSpinner label="Loading seats..." />
      ) : (
        <div className="space-y-4">
          {bays.map((bay) => {
            const seats = seatsByBay[bay.id] || [];
            const occCount = seats.filter((s) => s.status === "OCCUPIED").length;
            const availCount = seats.filter((s) => s.status === "AVAILABLE").length;
            return (
              <div key={bay.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
                      {bay.code.split("-")[1]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{bay.name}</h3>
                      <div className="text-[11px] text-slate-500 font-mono">{bay.code} · capacity {bay.capacity}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="badge badge-info badge-dot">{occCount} occupied</span>
                    <span className="badge badge-success badge-dot">{availCount} available</span>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))" }}>
                  {seats.map((seat) => (
                    <button
                      key={seat.id}
                      className={cn("seat seat-${status}", `seat-${seat.status.toLowerCase()}`)}
                      onMouseEnter={() => setHoveredSeat(seat)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      title={`${seat.seat_number} — ${seat.status}${seat.occupant_name ? ` — ${seat.occupant_name}` : ""}`}
                      onClick={() => handleSeatClick(seat)}
                    >
                      {seat.seat_number.split("-").pop()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side panel: selected seat */}
      {selectedSeat && (
        <div className="fixed bottom-6 right-6 w-80 card shadow-2xl border-slate-300 scale-in z-40" style={{ padding: "1.25rem" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Selected Seat</div>
              <div className="text-2xl font-bold font-mono mt-0.5 gradient-text">{selectedSeat.seat_number}</div>
            </div>
            <button className="text-slate-400 hover:text-slate-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100" onClick={() => setSelectedSeat(null)}>✕</button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status</span>
              <span className={cn(
                "badge badge-dot",
                selectedSeat.status === "AVAILABLE" ? "badge-success" :
                selectedSeat.status === "OCCUPIED" ? "badge-info" :
                selectedSeat.status === "RESERVED" ? "badge-warning" :
                "badge-danger"
              )}>{selectedSeat.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Floor / Bay</span>
              <span className="font-medium">{selectedSeat.floor_name} / {selectedSeat.bay_name}</span>
            </div>
            {selectedSeat.occupant_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Occupant</span>
                <div className="text-right">
                  <div className="font-medium">{selectedSeat.occupant_name}</div>
                  <div className="text-xs text-slate-500 font-mono">{selectedSeat.occupant_emp_code}</div>
                </div>
              </div>
            )}

            {selectedSeat.status === "AVAILABLE" && (
              <div className="pt-3 border-t border-slate-100">
                <label className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block mb-2">Allocate to new joiner</label>
                <select className="select mb-2" id="alloc-emp" defaultValue="">
                  <option value="" disabled>Select an onboarding employee...</option>
                  {onboardingEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.emp_code} — {e.full_name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary w-full"
                  disabled={allocating}
                  onClick={() => {
                    const sel = document.getElementById("alloc-emp") as HTMLSelectElement;
                    if (sel && sel.value) handleAllocate(selectedSeat.id, Number(sel.value));
                  }}
                >
                  {allocating ? <><span className="spinner" /> Allocating...</> : "Allocate Seat"}
                </button>
              </div>
            )}

            {selectedSeat.status === "OCCUPIED" && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  className="btn btn-danger w-full"
                  disabled={allocating}
                  onClick={() => handleRelease(selectedSeat.id)}
                >
                  {allocating ? <><span className="spinner" /> Releasing...</> : "Release Seat"}
                </button>
              </div>
            )}

            {(selectedSeat.status === "RESERVED" || selectedSeat.status === "MAINTENANCE") && (
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                This seat cannot be modified from this view. Use the API or admin tools.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
