import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkIn, checkOut, currentTimeInTz, getAttendanceSettings, getBrowserTimezone,
  getMyAttendanceHistory, getTodayAttendance, withinWindow,
} from "@/services/attendance";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

const StatusPill = ({ status }: { status: string | null | undefined }) => {
  const map: Record<string, string> = {
    present: "bg-success/15 text-success",
    late: "bg-warning/15 text-warning",
    absent: "bg-muted text-muted-foreground",
    half_day: "bg-warning/15 text-warning",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${map[status ?? "absent"] ?? "bg-muted"}`}>
      {(status ?? "absent").replace("_", " ")}
    </span>
  );
};

const Attendance = () => {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const { isAdmin } = useAuth();

  // Refresh every second so the live clock + button state stay accurate.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const settingsQ = useQuery({ queryKey: ["att-settings"], queryFn: getAttendanceSettings });
  const todayQ = useQuery({ queryKey: ["today-attendance"], queryFn: getTodayAttendance, enabled: !isAdmin });
  const histQ = useQuery({ queryKey: ["att-history"], queryFn: getMyAttendanceHistory, enabled: !isAdmin });

  const checkInMut = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-attendance"] });
      qc.invalidateQueries({ queryKey: ["att-history"] });
      toast.success("Checked in");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const checkOutMut = useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-attendance"] });
      qc.invalidateQueries({ queryKey: ["att-history"] });
      toast.success("Checked out");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const s = settingsQ.data;
  const today = todayQ.data;

  const tz = s?.timezone || "UTC";
  const browserTz = getBrowserTimezone();
  const tzMismatch = s && browserTz !== tz;
  const tzNow = s ? currentTimeInTz(now, tz) : "";

  const inWindowCheckIn = !!s && withinWindow(now, s.check_in_start, s.check_in_end, tz);
  const inWindowCheckOut = !!s && withinWindow(now, s.check_out_start, s.check_out_end, tz);

  const canCheckIn = !!s && !today?.check_in && inWindowCheckIn;
  const canCheckOut = !!s && !!today?.check_in && !today?.check_out && inWindowCheckOut;

  // Reason text for disabled buttons
  const checkInReason = (() => {
    if (!s) return "Loading…";
    if (today?.check_in) return "Already checked in today";
    if (!inWindowCheckIn) return `Outside check-in window (${s.check_in_start.slice(0,5)}–${s.check_in_end.slice(0,5)} ${tz})`;
    return null;
  })();
  const checkOutReason = (() => {
    if (!s) return "Loading…";
    if (!today?.check_in) return "Check in first";
    if (today?.check_out) return "Already checked out today";
    if (!inWindowCheckOut) return `Outside check-out window (${s.check_out_start.slice(0,5)}–${s.check_out_end.slice(0,5)} ${tz})`;
    return null;
  })();

  if (isAdmin) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gradient">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-2">Admin view</p>
        </div>
        <div className="card-glass p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="font-semibold text-lg mb-2">Admins don't check in</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Attendance check-in and check-out are for team members only. As an admin, you can review
            everyone's attendance and manage the allowed time windows.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild className="btn-gradient">
              <Link to="/admin/attendance">View all attendance</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gradient">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-2">Track your daily attendance</p>
      </div>

      {tzMismatch && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            Your device is in <span className="font-medium">{browserTz}</span>, but attendance windows are
            configured for <span className="font-medium">{tz}</span>. The current time shown below uses {tz}.
            {' '}Ask an admin to update the timezone if this is wrong.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Today</h2>
            </div>
            {s && (
              <div className="text-right">
                <div className="text-2xl font-mono font-semibold tabular-nums text-primary">{tzNow}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{tz}</div>
              </div>
            )}
          </div>
          <div className="space-y-3 mb-5">
            <Row label="Status" value={<StatusPill status={today?.status} />} />
            <Row label="Check-in" value={today?.check_in ? new Date(today.check_in).toLocaleTimeString() : "—"} />
            <Row label="Check-out" value={today?.check_out ? new Date(today.check_out).toLocaleTimeString() : "—"} />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => checkInMut.mutate()}
              disabled={!canCheckIn || checkInMut.isPending}
              className="flex-1 btn-gradient"
            >
              <LogIn className="h-4 w-4 mr-2" /> Check in
            </Button>
            <Button
              onClick={() => checkOutMut.mutate()}
              disabled={!canCheckOut || checkOutMut.isPending}
              variant="secondary"
              className="flex-1"
            >
              <LogOut className="h-4 w-4 mr-2" /> Check out
            </Button>
          </div>
          {(checkInReason || checkOutReason) && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {checkInReason && <div>• Check-in: {checkInReason}</div>}
              {checkOutReason && <div>• Check-out: {checkOutReason}</div>}
            </div>
          )}
        </div>

        <div className="card-glass p-6">
          <h2 className="font-semibold mb-4">Allowed windows</h2>
          {s ? (
            <div className="space-y-2 text-sm">
              <Row label="Timezone" value={s.timezone} />
              <Row
                label="Check-in"
                value={
                  <span className={inWindowCheckIn ? "text-success font-medium" : ""}>
                    {s.check_in_start.slice(0,5)} – {s.check_in_end.slice(0,5)}
                  </span>
                }
              />
              <Row
                label="Check-out"
                value={
                  <span className={inWindowCheckOut ? "text-success font-medium" : ""}>
                    {s.check_out_start.slice(0,5)} – {s.check_out_end.slice(0,5)}
                  </span>
                }
              />
              <p className="text-xs text-muted-foreground pt-2">
                Times are interpreted in <span className="font-medium">{tz}</span>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </div>

      <div className="card-glass">
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="font-semibold">History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Check-in</th>
                <th className="text-left px-6 py-3">Check-out</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(histQ.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-6 py-3">{r.date}</td>
                  <td className="px-6 py-3">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-3">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-3"><StatusPill status={r.status} /></td>
                </tr>
              ))}
              {(histQ.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default Attendance;
