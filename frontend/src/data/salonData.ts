import { SalonService, Barber } from '../types/salon';

export const SALON_SERVICES: SalonService[] = [
  {
    id: 'haircut',
    nameKey: 'services.haircut.name',
    defaultName: 'Classic Haircut',
    category: 'hair',
    durationMinutes: 30,
    price: 150,
    descriptionKey: 'services.haircut.desc',
    defaultDescription: 'Precision cut, hair wash, and styling'
  },
  {
    id: 'beard-trim',
    nameKey: 'services.beardTrim.name',
    defaultName: 'Beard Trim & Shape',
    category: 'beard',
    durationMinutes: 15,
    price: 80,
    descriptionKey: 'services.beardTrim.desc',
    defaultDescription: 'Custom shaping, razor edge, and soothing balm'
  },
  {
    id: 'hair-spa',
    nameKey: 'services.hairSpa.name',
    defaultName: 'Premium Hair Spa',
    category: 'spa',
    durationMinutes: 45,
    price: 400,
    descriptionKey: 'services.hairSpa.desc',
    defaultDescription: 'Deep conditioning treatment and scalp relaxation'
  },
  {
    id: 'shave-massage',
    nameKey: 'services.shaveMassage.name',
    defaultName: 'Royal Shave & Face Massage',
    category: 'beard',
    durationMinutes: 25,
    price: 120,
    descriptionKey: 'services.shaveMassage.desc',
    defaultDescription: 'Hot towel prep, smooth clean shave, and aloe massage'
  },
  {
    id: 'hair-color',
    nameKey: 'services.hairColor.name',
    defaultName: 'Hair Coloring',
    category: 'color',
    durationMinutes: 40,
    price: 350,
    descriptionKey: 'services.hairColor.desc',
    defaultDescription: 'Ammonia-free rich natural black or brown color'
  },
  {
    id: 'head-massage',
    nameKey: 'services.headMassage.name',
    defaultName: 'Ayurvedic Head Massage',
    category: 'spa',
    durationMinutes: 20,
    price: 100,
    descriptionKey: 'services.headMassage.desc',
    defaultDescription: 'Traditional cooling herbal oil head and neck therapy'
  }
];

export const SALON_BARBERS: Barber[] = [
  {
    id: 'ravi',
    name: 'Ravi',
    status: 'available',
    specializationKey: 'barbers.ravi.spec',
    defaultSpecialization: 'Haircut & Beard Specialist'
  },
  {
    id: 'amit',
    name: 'Amit',
    status: 'busy',
    specializationKey: 'barbers.amit.spec',
    defaultSpecialization: 'Styling & Fade Master',
    activeToken: 'S-14'
  },
  {
    id: 'imran',
    name: 'Imran',
    status: 'available',
    specializationKey: 'barbers.imran.spec',
    defaultSpecialization: 'Hair Spa & Color Expert'
  }
];

export const DEMO_QUEUE_STATS = {
  isDemo: true,
  waitingCount: 4,
  estimatedWaitMinutes: 25,
  operatingHours: '9:00 AM – 9:00 PM',
  onlineJoiningStatus: 'open'
};
