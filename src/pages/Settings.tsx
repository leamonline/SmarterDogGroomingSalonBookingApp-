import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";

export function Settings() {
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
                <Input defaultValue="Savvy Pet Spa" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Phone Number</label>
                <Input defaultValue="(555) 123-4567" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-900">Address</label>
                <Input defaultValue="123 Grooming Lane, Pet City, PC 12345" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button>Save Changes</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>Set your regular operating hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <div key={day} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="w-32 font-medium text-slate-900">{day}</div>
                <div className="flex items-center gap-2">
                  <Input type="time" defaultValue="08:00" className="w-32" disabled={day === 'Sunday'} />
                  <span className="text-slate-500">to</span>
                  <Input type="time" defaultValue="17:00" className="w-32" disabled={day === 'Sunday'} />
                </div>
                <div className="w-24 text-right">
                  {day === 'Sunday' ? (
                    <span className="text-sm text-red-500 font-medium">Closed</span>
                  ) : (
                    <span className="text-sm text-green-500 font-medium">Open</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button>Save Hours</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
