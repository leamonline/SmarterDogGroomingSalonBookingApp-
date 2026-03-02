import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { api } from "@/src/lib/api";

export function Settings() {
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
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
      alert("Profile saved successfully");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveHours = async () => {
    try {
      await api.updateSettings({ schedule });
      alert("Hours saved successfully");
    } catch (err) {
      console.error(err);
    }
  };

  const updateSchedule = (day: string, field: string, value: any) => {
    setSchedule((prev) => prev.map(s => s.day === day ? { ...s, [field]: value } : s));
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
      </div>
    </div>
  );
}
