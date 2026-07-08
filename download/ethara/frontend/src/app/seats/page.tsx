"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Floor, Bay, Seat, Employee } from "@/types";

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

  useEffect(() => {
    api.listFloors().then((f) => {
      setFloors(f);
      if (f.length > 0) setSelectedFloor(f[0].id);
    }).catch(() => {}).finally(() => {});
  }, []);

  const loadFloor = useCallback(async () => {
    if (!selectedFloor) return;
    setLoading(true);
    setMessage(null);
    try {
      const baysResp = await api.listBays(selectedFloor);
      setBays(baysResp);
      // Load all seats for this floor (limit high to get them all)
      const seatsResp = await api.listSeats({ floor_id: selectedFloor, limit: 1000 });
      const grouped: Record<number, Seat[]> = {};
      seatsResp.items.forEach((s: Seat) => {
        if (!grouped[s.bay_id]) grouped[s.bay_id] = [];
        grouped[s.bay_id].push(s);
      });
      // Sort seats within each bay by seat_number
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
    // If seat is available, load onboarding employees for allocation dropdown
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

  return (
    <div className="space-y-5 fade-in">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seat Map</h1>
          <p className="text-sm text-slate-600 mt-1">Interactive floor plan — click any seat to allocate or release.</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="seat seat-occupied" style={{ width: 14, height: 14 }} /> Occupied</span>
          <span className="flex items-center gap-1"><span className="seat seat-available" style={{ width: 14, height: 14 }} /> Available</span>
          <span className="flex items-center gap-1"><span className="seat seat-reserved" style={{ width: 14, height: 14 }} /> Reserved</span>
          <span className="flex items-center gap-1"><span className="seat seat-maintenance" style={{ width: 14, height: 14 }} /> Maintenance</span>
        </div>
      </header>

      {/* Floor selector */}
      <div className="flex flex-wrap gap-2">
        {floors.map((f) => (
          <button
            key={f.id}
            className={`btn ${selectedFloor === f.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSelectedFloor(f.id)}
          >
            {f.name}
            <span className="text-xs opacity-75 ml-2">({f.occupied_count ?? 0}/{f.seat_count ?? 0})</span>
          </button>
        ))}
      </div>

      {message && (
        <div className={`card ${message.type === "success" ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"} py-3`}>
          <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.type === "success" ? "✓ " : "✗ "}{message.text}
          </p>
        </div>
      )}

      {/* Seat map */}
      {loading ? (
        <div className="card text-center py-16 text-slate-500"><span className="spinner mr-2" />Loading seats...</div>
      ) : (
        <div className="space-y-6">
          {bays.map((bay) => {
            const seats = seatsByBay[bay.id] || [];
            return (
              <div key={bay.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{bay.name} <span className="text-xs text-slate-500 font-mono">({bay.code})</span></h3>
                  <div className="text-xs text-slate-500">
                    {seats.filter((s) => s.status === "OCCUPIED").length} / {seats.length} occupied
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))" }}>
                  {seats.map((seat) => (
                    <button
                      key={seat.id}
                      className={`seat seat-${seat.status.toLowerCase()}`}
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
        <div className="fixed bottom-6 right-6 w-80 card shadow-xl border-slate-300 fade-in">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Selected Seat</div>
              <div className="text-lg font-bold font-mono">{selectedSeat.seat_number}</div>
            </div>
            <button className="text-slate-400 hover:text-slate-700" onClick={() => setSelectedSeat(null)}>✕</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className={`badge ${
                selectedSeat.status === "AVAILABLE" ? "badge-success" :
                selectedSeat.status === "OCCUPIED" ? "badge-info" :
                selectedSeat.status === "RESERVED" ? "badge-warning" :
                "badge-danger"
              }`}>{selectedSeat.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Floor / Bay</span>
              <span>{selectedSeat.floor_name} / {selectedSeat.bay_name}</span>
            </div>
            {selectedSeat.occupant_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Occupant</span>
                <span>{selectedSeat.occupant_name} <span className="text-xs text-slate-500">({selectedSeat.occupant_emp_code})</span></span>
              </div>
            )}

            {selectedSeat.status === "AVAILABLE" && (
              <div className="pt-3 border-t border-slate-100">
                <label className="text-xs text-slate-500 uppercase font-semibold block mb-1">Allocate to new joiner</label>
                <select
                  className="select mb-2"
                  id="alloc-emp"
                  defaultValue=""
                >
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
                  {allocating ? "Allocating..." : "Allocate Seat"}
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
                  {allocating ? "Releasing..." : "Release Seat"}
                </button>
              </div>
            )}

            {(selectedSeat.status === "RESERVED" || selectedSeat.status === "MAINTENANCE") && (
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                This seat cannot be modified from this view. Use the API or admin tools.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
