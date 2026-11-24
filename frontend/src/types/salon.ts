export interface SalonService {
  id: string;
  nameKey: string;
  defaultName: string;
  category: 'hair' | 'beard' | 'spa' | 'color';
  durationMinutes: number;
  price: number;
  descriptionKey: string;
  defaultDescription: string;
}

export type BarberStatus = 'available' | 'busy' | 'break';

export interface Barber {
  id: string;
  name: string;
  status: BarberStatus;
  specializationKey: string;
  defaultSpecialization: string;
  activeToken?: string;
}

export interface JoinQueueFormState {
  customerName: string;
  phoneNumber: string;
  selectedServiceIds: string[];
  barberPreference: string; // 'any' or barber id
}

export interface JoinQueueValidationErrors {
  customerName?: string;
  phoneNumber?: string;
  services?: string;
  barberPreference?: string;
}
