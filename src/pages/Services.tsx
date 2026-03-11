import { useEffect, useState } from "react";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { api } from "@/src/lib/api";
import { Badge } from "@/src/components/ui/badge";
import { ServiceModal, Service } from "@/src/components/ServiceModal";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { toast } from "sonner";
import { handleError } from "@/src/lib/handleError";
import { formatCurrency } from "@/src/lib/utils";
import { ServicesSkeleton } from "@/src/components/ui/skeleton";

export function Services() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getServices();
        setServices(data);
      } catch (err) {
        handleError(err, "Failed to load services");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)));
  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.category && service.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = activeCategory === "All" || service.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (activeCategory !== "All" && !categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categories]);

  const handleCreate = () => {
    setSelectedService(null);
    setIsModalOpen(true);
  };

  const handleEdit = (service: Service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      await api.deleteService(serviceToDelete);
      setServices(services.filter((s) => s.id !== serviceToDelete));
      toast.success("Service deleted.");
    } catch (err) {
      handleError(err, "Failed to delete service");
    } finally {
      setServiceToDelete(null);
    }
  };

  const handleDelete = (id: string) => {
    setServiceToDelete(id);
  };

  const handleSaveService = async (service: Service) => {
    try {
      if (selectedService) {
        await api.updateService(service.id, service);
        setServices((prev) => prev.map((s) => (s.id === service.id ? service : s)));
      } else {
        await api.createService(service);
        setServices((prev) => [...prev, service]);
      }
    } catch (err) {
      handleError(err, "Failed to save service");
    }
  };

  if (loading) return <ServicesSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-purple">Services</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex-1 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-slate-500">
            Showing {filteredServices.length} of {services.length} services
            {activeCategory !== "All" ? ` in ${activeCategory}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge
            variant={activeCategory === "All" ? "secondary" : "outline"}
            className="cursor-pointer hover:bg-slate-100"
            onClick={() => setActiveCategory("All")}
          >
            All
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category}
              variant={activeCategory === category ? "secondary" : "outline"}
              className="cursor-pointer hover:bg-slate-100"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {filteredServices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="rounded-full bg-slate-100 p-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">No services match that filter</p>
            <p className="text-sm text-slate-500">Try a different search term or switch back to all categories.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription className="mt-1">{service.category}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900">
                      {service.priceType === "from"
                        ? `From ${formatCurrency(service.price)}`
                        : formatCurrency(service.price)}
                    </div>
                    <div className="text-xs text-slate-500">{service.duration} mins</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="text-sm text-slate-600">{service.description || "No description yet."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {service.isOnlineBookable !== false && <Badge variant="secondary">Online booking</Badge>}
                  {service.depositRequired && service.depositAmount > 0 && (
                    <Badge variant="outline">Deposit {formatCurrency(service.depositAmount)}</Badge>
                  )}
                  {service.isApprovalRequired && <Badge variant="outline">Approval required</Badge>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-sm font-medium text-slate-500">Duration: {service.duration} mins</div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-brand-600"
                      onClick={() => handleEdit(service)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-coral"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        service={selectedService}
        onSave={handleSaveService}
      />
      <ConfirmDialog
        isOpen={!!serviceToDelete}
        title="Delete Service"
        description="Are you sure you want to delete this service? It cannot be undone."
        confirmText="Delete Service"
        onConfirm={confirmDelete}
        onCancel={() => setServiceToDelete(null)}
      />
    </div>
  );
}
