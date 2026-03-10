import { useEffect, useState } from "react";
import { toast } from "sonner";
import { handleError } from "@/src/lib/handleError";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { Shield, UserPlus, Users } from "lucide-react";
import {
  BOOKING_CLOSE_TIME,
  BOOKING_OPEN_TIME,
  type BookingScheduleDay,
  formatScheduleTime,
  normalizeScheduleDays,
} from "@/src/lib/bookingSchedule";

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  receptionist: 'Receptionist',
  groomer: 'Groomer',
  customer: 'Customer',
};

const ROLE_COLOURS: Record<string, string> = {
  owner: 'bg-purple-light/30 text-purple',
  receptionist: 'bg-sky-light text-brand-700',
  groomer: 'bg-sage-light text-brand-700',
  customer: 'bg-slate-100 text-slate-800',
};

export function Settings() {
  const { isAdmin, isOwner, user: currentUser } = useAuth();

  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [schedule, setSchedule] = useState<BookingScheduleDay[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("groomer");

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        setShopName(data.shopName || "");
        setShopPhone(data.shopPhone || "");
        setShopAddress(data.shopAddress || "");
        setSchedule(normalizeScheduleDays(data.schedule));

        // Only load staff list if admin
        if (isAdmin) {
          try {
            const staffData = await api.getStaff();
            setStaff(staffData);
          } catch {
            // If not an admin, the endpoint will 403 — that's expected
          }
        }
      } catch (err) {
        handleError(err, "Failed to load settings");
      }
    }
    loadSettings();
  }, [isAdmin]);

  const handleSaveProfile = async () => {
    try {
      await api.updateSettings({ shopName, shopPhone, shopAddress });
      toast.success("Profile saved successfully");
    } catch (err) {
      toast.error("Failed to save profile");
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await api.updateSettings({ schedule });
      toast.success("Booking schedule saved successfully");
    } catch (err) {
      toast.error("Failed to save booking schedule");
    }
  };

  const updateScheduleDay = (day: string, updater: (current: BookingScheduleDay) => BookingScheduleDay) => {
    setSchedule((prev) => prev.map((entry) => (entry.day === day ? updater(entry) : entry)));
  };

  const toggleDayClosed = (day: string, isClosed: boolean) => {
    updateScheduleDay(day, (current) => ({ ...current, isClosed }));
  };

  const toggleSlotAvailability = (day: string, time: string) => {
    updateScheduleDay(day, (current) => ({
      ...current,
      slots: current.slots.map((slot) =>
        slot.time === time ? { ...slot, isAvailable: !slot.isAvailable } : slot,
      ),
    }));
  };

  const setAllSlotsForDay = (day: string, isAvailable: boolean) => {
    updateScheduleDay(day, (current) => ({
      ...current,
      slots: current.slots.map((slot) => ({ ...slot, isAvailable })),
    }));
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await api.updatePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffEmail || !newStaffPassword) {
      toast.error("Email and password required.");
      return;
    }
    if (newStaffPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      const res = await api.createStaff({ email: newStaffEmail, password: newStaffPassword, role: newStaffRole });
      toast.success(`${ROLE_LABELS[res.role]} account created for ${res.email}`);
      setStaff([...staff, res]);
      setNewStaffEmail("");
      setNewStaffPassword("");
      setNewStaffRole("groomer");
    } catch (err: any) {
      toast.error(err.message || "Failed to create staff account");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateStaffRole(userId, newRole);
      setStaff(prev => prev.map(s => s.id === userId ? { ...s, role: newRole } : s));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple">Settings</h1>
        <p className="text-slate-500">Manage your shop preferences and account settings.</p>
      </div>

      <div className="grid gap-6">
        {/* Shop Profile — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Shop Profile</CardTitle>
              <CardDescription>Update your business information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Shop Name</label>
                  <Input value={shopName} onChange={e => setShopName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Phone Number</label>
                  <Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-900">Address</label>
                  <Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={handleSaveProfile}>Save Changes</Button>
            </CardFooter>
          </Card>
        )}

        {/* Booking Schedule — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Booking Schedule</CardTitle>
              <CardDescription>Choose which days are open and exactly which start times can be booked online.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Fixed booking hours: {formatScheduleTime(BOOKING_OPEN_TIME)} to {formatScheduleTime(BOOKING_CLOSE_TIME)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Appointments start in 30-minute increments and each half-hour slot can handle up to 2 dogs.
                </p>
              </div>

              <div className="space-y-4">
                {schedule.map((daySchedule) => {
                  const availableCount = daySchedule.slots.filter((slot) => slot.isAvailable).length;

                  return (
                    <div
                      key={daySchedule.day}
                      className={`rounded-2xl border p-4 transition-colors ${daySchedule.isClosed ? "border-slate-200 bg-slate-50" : "border-brand-100 bg-white"}`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">{daySchedule.day}</h3>
                            <Badge variant={daySchedule.isClosed ? "outline" : "secondary"}>
                              {daySchedule.isClosed ? "Closed" : "Open"}
                            </Badge>
                            <Badge variant="outline">
                              {availableCount}/{daySchedule.slots.length} starts bookable
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500">
                            {daySchedule.isClosed
                              ? "Online booking is blocked for the full day until you reopen it."
                              : `Customers can book between ${formatScheduleTime(daySchedule.openTime || BOOKING_OPEN_TIME)} and ${formatScheduleTime(daySchedule.closeTime || BOOKING_CLOSE_TIME)}.`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={daySchedule.isClosed ? "secondary" : "outline"}
                            onClick={() => toggleDayClosed(daySchedule.day, false)}
                          >
                            Open Day
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={daySchedule.isClosed ? "outline" : "secondary"}
                            onClick={() => toggleDayClosed(daySchedule.day, true)}
                          >
                            Close Day
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setAllSlotsForDay(daySchedule.day, true)}
                          >
                            All Slots On
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setAllSlotsForDay(daySchedule.day, false)}
                          >
                            All Slots Off
                          </Button>
                        </div>
                      </div>

                      <div className={`mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 ${daySchedule.isClosed ? "opacity-70" : ""}`}>
                        {daySchedule.slots.map((slot) => (
                          <button
                            key={`${daySchedule.day}-${slot.time}`}
                            type="button"
                            onClick={() => toggleSlotAvailability(daySchedule.day, slot.time)}
                            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                              slot.isAvailable
                                ? "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            <div className="text-sm font-semibold">{formatScheduleTime(slot.time)}</div>
                            <div className="mt-1 text-xs">
                              {slot.isAvailable ? "Available to book" : "Unavailable"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={handleSaveSchedule}>Save Booking Schedule</Button>
            </CardFooter>
          </Card>
        )}

        {/* Password — always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-slate-400" /> Security</CardTitle>
            <CardDescription>Change your password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-900">Current Password</label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">New Password</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Confirm New Password</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button onClick={handleChangePassword}>Change Password</Button>
          </CardFooter>
        </Card>

        {/* Staff Management — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-slate-400" /> Staff Accounts</CardTitle>
              <CardDescription>Manage staff access and roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Current Staff</h4>
                <div className="grid gap-2">
                  {staff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-900">{s.email}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLOURS[s.role] || ROLE_COLOURS.groomer}`}>
                          {ROLE_LABELS[s.role] || s.role}
                        </span>
                        {s.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      {isOwner && s.id !== currentUser?.id && (
                        <select
                          title="Change user role"
                          value={s.role || 'groomer'}
                          onChange={(e) => handleRoleChange(s.id, e.target.value)}
                          className="text-sm border border-brand-200 rounded-xl px-2 py-1 bg-white text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                        >
                          <option value="groomer">Groomer</option>
                          <option value="receptionist">Receptionist</option>
                          <option value="owner">Owner</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Staff Member</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Email Address</label>
                    <Input type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="Email" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Password</label>
                    <Input type="password" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} placeholder="Password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Role</label>
                    <select
                      title="Select role for new staff member"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    >
                      <option value="groomer">Groomer</option>
                      <option value="receptionist">Receptionist</option>
                      {isOwner && <option value="owner">Owner</option>}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={handleAddStaff}>Add Staff Account</Button>
            </CardFooter>
          </Card>
        )}

        {/* Not admin notice */}
        {!isAdmin && (
          <Card>
            <CardContent className="py-8 text-center">
              <Shield className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Shop settings and staff management are restricted to Receptionists and Owners.</p>
              <p className="text-xs text-slate-400 mt-1">Your role: <span className="font-medium">{ROLE_LABELS[currentUser?.role || ''] || 'Unknown'}</span></p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
