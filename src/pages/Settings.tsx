import { useEffect, useState } from "react";
import { toast } from "sonner";
import { handleError } from "@/src/lib/handleError";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { BookingScheduleEditor } from "@/src/components/BookingScheduleEditor";
import { api } from "@/src/lib/api";
import { validatePasswordStrength } from "@/src/lib/passwordValidation";
import { useAuth } from "@/src/lib/AuthContext";
import { Shield, UserPlus, Users, Scissors } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type BookingScheduleDay, normalizeScheduleDays } from "@/src/lib/bookingSchedule";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  receptionist: "Receptionist",
  groomer: "Groomer",
  customer: "Customer",
};

const ROLE_COLOURS: Record<string, string> = {
  owner: "bg-purple-light/30 text-purple",
  receptionist: "bg-sky-light text-brand-700",
  groomer: "bg-sage-light text-brand-700",
  customer: "bg-slate-100 text-slate-800",
};

export function Settings() {
  const { isAdmin, isOwner, user: currentUser } = useAuth();
  const navigate = useNavigate();

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
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await api.updateSettings({ schedule });
      toast.success("Booking schedule saved successfully");
    } catch {
      toast.error("Failed to save booking schedule");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      toast.error(passwordError);
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
    const passwordError = validatePasswordStrength(newStaffPassword);
    if (passwordError) {
      toast.error(passwordError);
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
      setStaff((prev) => prev.map((s) => (s.id === userId ? { ...s, role: newRole } : s)));
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
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Secondary tools</CardTitle>
              <CardDescription>
                Keep service setup available without putting it in the main daily navigation.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/services")}>
                <Scissors className="mr-2 h-4 w-4" />
                Open Services
              </Button>
            </CardContent>
          </Card>
        )}

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
                  <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Phone Number</label>
                  <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-900">Address</label>
                  <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
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
              <CardDescription>
                Choose which days are open and exactly which start times can be booked online.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingScheduleEditor schedule={schedule} setSchedule={setSchedule} />
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={handleSaveSchedule}>Save Booking Schedule</Button>
            </CardFooter>
          </Card>
        )}

        {/* Password — always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" /> Security
            </CardTitle>
            <CardDescription>Change your password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-900">Current Password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Confirm New Password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-400" /> Staff Accounts
              </CardTitle>
              <CardDescription>Manage staff access and roles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Current Staff</h4>
                <div className="grid gap-2">
                  {staff.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-900">{s.email}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLOURS[s.role] || ROLE_COLOURS.groomer}`}
                        >
                          {ROLE_LABELS[s.role] || s.role}
                        </span>
                        {s.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      {isOwner && s.id !== currentUser?.id && (
                        <select
                          title="Change user role"
                          value={s.role || "groomer"}
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
                <h4 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Add Staff Member
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Email Address</label>
                    <Input
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="Email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Password</label>
                    <Input
                      type="password"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="Password"
                    />
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
              <p className="text-sm font-medium text-slate-500">
                Shop settings and staff management are restricted to Receptionists and Owners.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Your role: <span className="font-medium">{ROLE_LABELS[currentUser?.role || ""] || "Unknown"}</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
