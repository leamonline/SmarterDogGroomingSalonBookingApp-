export type Vaccination = {
  name: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'missing';
};

export type Pet = {
  id: string;
  name: string;
  breed: string;
  weight: number; // in lbs
  dob: string;
  coatType: string;
  behavioralNotes: string[];
  vaccinations: Vaccination[];
};

export type Document = {
  id: string;
  name: string;
  type: string; // e.g., 'pdf', 'image', 'doc'
  uploadDate: string;
  url: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
  notes: string;
  warnings: string[];
  pets: Pet[];
  lastVisit: string;
  totalSpent: number;
  documents?: Document[];
};
