import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  getAllAttendance, getAttendanceSettings, updateAttendanceSettings,
  getBrowserTimezone,
} from "@/services/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";

// Build a sorted list of IANA timezones from the runtime when available,
// with a curated fallback list for older browsers.
function getAllTimezones(): string[] {
  try {
    // @ts-ignore - supportedValuesOf is widely supported in modern browsers
    const tz = Intl.supportedValuesOf?.("timeZone") as string[] | undefined;
    if (tz && tz.length > 0) return tz;
  } catch {}
  return [
    "UTC",
    "Africa/Cairo","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi",
    "America/Anchorage","America/Argentina/Buenos_Aires","America/Bogota","America/Chicago","America/Denver","America/Halifax","America/Lima","America/Los_Angeles","America/Mexico_City","America/New_York","America/Phoenix","America/Sao_Paulo","America/Toronto","America/Vancouver",
    "Asia/Bangkok","Asia/Dhaka","Asia/Dubai","Asia/Hong_Kong","Asia/Jakarta","Asia/Jerusalem","Asia/Kolkata","Asia/Kuala_Lumpur","Asia/Manila","Asia/Riyadh","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Taipei","Asia/Tehran","Asia/Tokyo",
    "Australia/Adelaide","Australia/Brisbane","Australia/Melbourne","Australia/Perth","Australia/Sydney",
    "Europe/Amsterdam","Europe/Athens","Europe/Berlin","Europe/Brussels","Europe/Bucharest","Europe/Dublin","Europe/Helsinki","Europe/Istanbul","Europe/Lisbon","Europe/London","Europe/Madrid","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Prague","Europe/Rome","Europe/Stockholm","Europe/Vienna","Europe/Warsaw","Europe/Zurich",
    "Pacific/Auckland","Pacific/Fiji","Pacific/Honolulu",
  ];
}

interface SettingsValues {
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  timezone: string;
}

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    present: "bg-success/15 text-success",
    late: "bg-warning/15 text-warning",
    absent: "bg-muted text-muted-foreground",
    half_day: "bg-warning/15 text-warning",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md capitalize ${map[status] ?? "bg-muted"}`}>
      {status.replace("_", " ")}
    </span>
  );
};

const AdminAttendance = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>("");
  const [tzFilter, setTzFilter] = useState("");
  const allTimezones = useMemo(() => getAllTimezones(), []);

  const settingsQ = useQuery({ queryKey: ["att-settings"], queryFn: getAttendanceSettings });
  const recordsQ = useQuery({
    queryKey: ["all-att", date],
    queryFn: () => getAllAttendance({ date: date || undefined }),
  });

  const { register, handleSubmit, setValue, watch } = useForm<SettingsValues>();
  const tzValue = watch("timezone") || settingsQ.data?.timezone || "UTC";

  const settingsMut = useMutation({
    mutationFn: updateAttendanceSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["att-settings"] });
      toast.success("Settings updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const records = recordsQ.data ?? [];
  const stats = {
    present: records.filter((r: any) => r.status === "present").length,
    late: records.filter((r: any) => r.status === "late").length,
    absent: records.filter((r: any) => r.status === "absent").length,
    half_day: records.filter((r: any) => r.status === "half_day").length,
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">All Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">View records and configure windows</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Present" value={stats.present} />
          <Stat label="Late" value={stats.late} />
          <Stat label="Absent" value={stats.absent} />
          <Stat label="Half day" value={stats.half_day} />
        </div>

        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Window settings</h2>
          </div>
          {settingsQ.data && (
            <form
              key={settingsQ.dataUpdatedAt}
              onSubmit={handleSubmit((v) => settingsMut.mutate(v))}
              className="space-y-2 text-xs"
            >
              <Field label="Timezone">
                {/* Hidden RHF-registered input — value driven by the Select below */}
                <input
                  type="hidden"
                  defaultValue={settingsQ.data.timezone}
                  {...register("timezone", { required: true })}
                />
                <div className="flex gap-2">
                  <Select
                    value={tzValue}
                    onValueChange={(v) =>
                      setValue("timezone", v, { shouldDirty: true, shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <div className="px-2 pt-2 pb-1 sticky top-0 bg-popover z-10">
                        <Input
                          autoFocus
                          placeholder="Search timezone…"
                          value={tzFilter}
                          onChange={(e) => setTzFilter(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8 text-xs"
                        />
                      </div>
                      {allTimezones
                        .filter((tz) =>
                          tz.toLowerCase().includes(tzFilter.toLowerCase()),
                        )
                        .slice(0, 200)
                        .map((tz) => (
                          <SelectItem key={tz} value={tz} className="text-xs">
                            {tz}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() =>
                      setValue("timezone", getBrowserTimezone(), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    title="Use browser timezone"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Current: <span className="font-medium">{tzValue}</span>
                </p>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Check-in start">
                  <Input type="time" defaultValue={settingsQ.data.check_in_start.slice(0,5)} {...register("check_in_start", { required: true })} />
                </Field>
                <Field label="Check-in end">
                  <Input type="time" defaultValue={settingsQ.data.check_in_end.slice(0,5)} {...register("check_in_end", { required: true })} />
                </Field>
                <Field label="Check-out start">
                  <Input type="time" defaultValue={settingsQ.data.check_out_start.slice(0,5)} {...register("check_out_start", { required: true })} />
                </Field>
                <Field label="Check-out end">
                  <Input type="time" defaultValue={settingsQ.data.check_out_end.slice(0,5)} {...register("check_out_end", { required: true })} />
                </Field>
              </div>
              <Button type="submit" size="sm" className="w-full mt-2" disabled={settingsMut.isPending}>
                Save
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="card-elevated">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="font-semibold">Records</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-date" className="text-xs text-muted-foreground">Filter date</Label>
            <Input
              id="filter-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 h-8"
            />
            {date && (
              <Button variant="ghost" size="sm" onClick={() => setDate("")}>Clear</Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Check-in</th>
                <th className="text-left px-6 py-3">Check-out</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-6 py-3">
                    <div className="font-medium">{r.profiles?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                  </td>
                  <td className="px-6 py-3">{r.date}</td>
                  <td className="px-6 py-3">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-3">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="px-6 py-3"><StatusPill status={r.status} /></td>
                </tr>
              ))}
              {records.length === 0 && !recordsQ.isLoading && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="stat-card">
    <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className="text-2xl font-semibold">{value}</span>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

export default AdminAttendance;
