import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { api } from "@/src/lib/api";

export function Settings() {
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [schedule, setSchedule] = useState<any[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const [data, staffData] = await Promise.all([
          api.getSettings(),
          api.getStaff()
        ]);
        setStaff(staffData);
        setShopName(data.shopName || "");
        setShopPhone(data.shopPhone || "");
        setShopAddress(data.shopAddress || "");
        if (data.schedule && data.schedule.length > 0) {
          setSchedule(data.schedule);
        } else {
          // Default if empty
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          setSchedule(days.map((day) => ({
            day,
            openTime: "08:00",
            closeTime: "17:00",
            isClosed: day === 'Sunday'
          })));
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    loadSettings();
  }, []);

  const handleSaveProfile = async () => {
    try {
      await api.updateSettings({ shopName, shopPhone, shopAddress });
      toast.success("Profile saved successfully");
    } catch (err) {
      toast.error("Failed to save profile");
    }
  };

  const handleSaveHours = async () => {
    try {
      await api.updateSettings({ schedule });
      toast.success("Hours saved successfully");
    } catch (err) {
      toast.error("Failed to save hours");
    }
  };

  const updateSchedule = (day: string, field: string, value: any) => {
    setSchedule((prev) => prev.map(s => s.day === day ? { ...s, [field]: value } : s));
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
      const res = await api.createStaff({ email: newStaffEmail, password: newStaffPassword });
      toast.success("Staff account created");
      setStaff([...staff, res]);
      setNewStaffEmail("");
      setNewStaffPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create staff account");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your shop preferences and account settings.</p>
      </div>

      <div className="grid gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>Set your regular operating hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule.map((s) => (
              <div key={s.day} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="w-32 font-medium text-slate-900 flex items-center gap-2">
                  <input type="checkbox" checked={!s.isClosed} onChange={(e) => updateSchedule(s.day, 'isClosed', !e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  {s.day}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="time" value={s.openTime || ""} onChange={e => updateSchedule(s.day, 'openTime', e.target.value)} className="w-32" disabled={s.isClosed} />
                  <span className="text-slate-500">to</span>
                  <Input type="time" value={s.closeTime || ""} onChange={e => updateSchedule(s.day, 'closeTime', e.target.value)} className="w-32" disabled={s.isClosed} />
                </div>
                <div className="w-24 text-right">
                  {s.isClosed ? (
                    <span className="text-sm text-red-500 font-medium">Closed</span>
                  ) : (
                    <span className="text-sm text-green-500 font-medium">Open</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button onClick={handleSaveHours}>Save Hours</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Staff Accounts</CardTitle>
            <CardDescription>Manage staff access to the Pet Spa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900">Current Staff</h4>
              <div className="grid gap-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium text-slate-900">{s.email}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-900 mb-4">Add Staff Member</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Email Address</label>
                  <Input type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="Email" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Password</label>
                  <Input type="password" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} placeholder="Password" />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button onClick={handleAddStaff}>Add Staff Account</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
