import { Customer } from "../types";

export const mockAppointments = [
  {
    id: "1",
    petName: "Bella",
    breed: "Golden Retriever",
    ownerName: "Sarah Johnson",
    service: "Full Groom",
    date: new Date(new Date().setHours(9, 0, 0, 0)),
    duration: 120, // minutes
    status: "in-progress",
    price: 85,
    avatar: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=150&h=150&fit=crop&q=80"
  },
  {
    id: "2",
    petName: "Max",
    breed: "French Bulldog",
    ownerName: "Michael Chen",
    service: "Bath & Brush",
    date: new Date(new Date().setHours(11, 30, 0, 0)),
    duration: 60,
    status: "scheduled",
    price: 45,
    avatar: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=150&h=150&fit=crop&q=80"
  },
  {
    id: "3",
    petName: "Luna",
    breed: "Poodle",
    ownerName: "Emily Davis",
    service: "Puppy Trim",
    date: new Date(new Date().setHours(13, 0, 0, 0)),
    duration: 90,
    status: "scheduled",
    price: 65,
    avatar: "https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?w=150&h=150&fit=crop&q=80"
  },
  {
    id: "4",
    petName: "Charlie",
    breed: "Beagle",
    ownerName: "David Wilson",
    service: "Nail Trim",
    date: new Date(new Date().setHours(15, 0, 0, 0)),
    duration: 15,
    status: "completed",
    price: 15,
    avatar: "https://images.unsplash.com/photo-1537151608804-ea6f11840eb3?w=150&h=150&fit=crop&q=80"
  },
  {
    id: "5",
    petName: "Daisy",
    breed: "Shih Tzu",
    ownerName: "Jessica Taylor",
    service: "Full Groom",
    date: new Date(new Date().setHours(15, 30, 0, 0)),
    duration: 120,
    status: "scheduled",
    price: 75,
    avatar: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&h=150&fit=crop&q=80"
  }
];

export const mockCustomers: Customer[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@example.com",
    phone: "(555) 123-4567",
    address: "123 Maple Street, Anytown, CA 90210",
    emergencyContact: {
      name: "Mark Johnson",
      phone: "(555) 123-4568"
    },
    notes: "Prefers morning appointments.",
    warnings: ["Late cancellation risk"],
    pets: [
      {
        id: "p1",
        name: "Bella",
        breed: "Golden Retriever",
        weight: 65,
        dob: "2019-04-12",
        coatType: "Double Coat",
        behavioralNotes: ["Friendly", "Loves water"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2026-05-01", status: "valid" },
          { name: "Bordetella", expiryDate: "2025-10-15", status: "valid" }
        ]
      }
    ],
    lastVisit: "2023-10-15",
    totalSpent: 425,
    documents: [
      {
        id: "d1",
        name: "Rabies Certificate 2023",
        type: "pdf",
        uploadDate: "2023-05-01",
        url: "#"
      },
      {
        id: "d2",
        name: "Vet Records - Spay",
        type: "pdf",
        uploadDate: "2020-01-15",
        url: "#"
      }
    ]
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "mchen@example.com",
    phone: "(555) 987-6543",
    address: "456 Oak Avenue, Apt 4B, Anytown, CA 90211",
    emergencyContact: {
      name: "Lisa Chen",
      phone: "(555) 987-6544"
    },
    notes: "",
    warnings: [],
    pets: [
      {
        id: "p2",
        name: "Max",
        breed: "French Bulldog",
        weight: 28,
        dob: "2021-08-20",
        coatType: "Short",
        behavioralNotes: ["Anxious around clippers"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2024-01-10", status: "expired" },
          { name: "Bordetella", expiryDate: "2025-02-20", status: "valid" }
        ]
      },
      {
        id: "p3",
        name: "Cooper",
        breed: "French Bulldog",
        weight: 25,
        dob: "2022-01-15",
        coatType: "Short",
        behavioralNotes: ["Playful"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2026-01-10", status: "valid" },
          { name: "Bordetella", expiryDate: "2025-02-20", status: "valid" }
        ]
      }
    ],
    lastVisit: "2023-10-20",
    totalSpent: 210
  },
  {
    id: "3",
    name: "Emily Davis",
    email: "emily.davis@example.com",
    phone: "(555) 456-7890",
    address: "789 Pine Road, Anytown, CA 90212",
    emergencyContact: {
      name: "Robert Davis",
      phone: "(555) 456-7891"
    },
    notes: "Always requests the same groomer (Sarah).",
    warnings: ["Requires muzzle for nail trims"],
    pets: [
      {
        id: "p4",
        name: "Luna",
        breed: "Poodle",
        weight: 15,
        dob: "2020-11-05",
        coatType: "Curly",
        behavioralNotes: ["Nippy with paws"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2025-11-05", status: "valid" },
          { name: "Bordetella", expiryDate: "2024-11-05", status: "expired" }
        ]
      }
    ],
    lastVisit: "2023-09-05",
    totalSpent: 130
  },
  {
    id: "4",
    name: "David Wilson",
    email: "dwilson@example.com",
    phone: "(555) 222-3333",
    address: "321 Elm Street, Anytown, CA 90213",
    emergencyContact: {
      name: "Sarah Wilson",
      phone: "(555) 222-3334"
    },
    notes: "",
    warnings: [],
    pets: [
      {
        id: "p5",
        name: "Charlie",
        breed: "Beagle",
        weight: 30,
        dob: "2018-06-30",
        coatType: "Short",
        behavioralNotes: ["Vocal", "Food motivated"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2025-06-30", status: "valid" },
          { name: "Bordetella", expiryDate: "2025-06-30", status: "valid" }
        ]
      }
    ],
    lastVisit: "2023-10-25",
    totalSpent: 45
  },
  {
    id: "5",
    name: "Jessica Taylor",
    email: "jtaylor@example.com",
    phone: "(555) 444-5555",
    address: "654 Birch Lane, Anytown, CA 90214",
    emergencyContact: {
      name: "Tom Taylor",
      phone: "(555) 444-5556"
    },
    notes: "VIP Client. Tip well.",
    warnings: [],
    pets: [
      {
        id: "p6",
        name: "Daisy",
        breed: "Shih Tzu",
        weight: 12,
        dob: "2022-03-14",
        coatType: "Long",
        behavioralNotes: ["Very sweet", "Good on table"],
        vaccinations: [
          { name: "Rabies", expiryDate: "2026-03-14", status: "valid" },
          { name: "Bordetella", expiryDate: "2025-09-14", status: "valid" }
        ]
      }
    ],
    lastVisit: "2023-08-12",
    totalSpent: 300
  }
];

export const mockServices = [
  {
    id: "1",
    name: "Full Groom",
    description: "Bath, brush, haircut, nail trim, ear cleaning",
    duration: 120,
    price: 85,
    category: "Grooming"
  },
  {
    id: "2",
    name: "Bath & Brush",
    description: "Bath, brush out, blow dry",
    duration: 60,
    price: 45,
    category: "Bathing"
  },
  {
    id: "3",
    name: "Puppy Trim",
    description: "Introductory groom for puppies under 6 months",
    duration: 90,
    price: 65,
    category: "Grooming"
  },
  {
    id: "4",
    name: "Nail Trim",
    description: "Nail clipping and filing",
    duration: 15,
    price: 15,
    category: "Add-on"
  },
  {
    id: "5",
    name: "Teeth Cleaning",
    description: "Brushing and breath freshener",
    duration: 15,
    price: 10,
    category: "Add-on"
  },
  {
    id: "6",
    name: "De-shedding Treatment",
    description: "Special shampoo and extensive brush out",
    duration: 30,
    price: 25,
    category: "Add-on"
  }
];
