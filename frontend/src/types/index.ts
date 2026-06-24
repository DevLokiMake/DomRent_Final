export interface City {
  id: number;
  name: string;
  createdAt?: string;
}

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Property {
  id: number;
  title: string;
  description: string;
  price: number;
  cityId?: number;
  city?: City | string;
  images: string[];
  coverImage?: string | null;
  type: 'квартира' | 'дом' | 'комната';
  contractType?: 'RENT' | 'SALE';
  ownerId: number;
  latitude?: number | null;
  longitude?: number | null;
  // Новые поля
  rooms?: number | null;
  hasWifi?: boolean;
  hasParking?: boolean;
  petsAllowed?: boolean;
  status?: ModerationStatus;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    bookings?: number;
    reviews?: number;
    favorites?: number;
  };
}

export interface PropertyOwner {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
}

export interface PropertyWithOwner extends Property {
  owner: PropertyOwner;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: 'USER' | 'LANDLORD' | 'ADMIN';
  isBanned?: boolean;
  telegramId: string | null;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface Booking {
  id: number;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  userId: number;
  propertyId: number;
  createdAt: string;
  property?: Property;
}

export interface Favorite {
  id: number;
  userId: number;
  propertyId: number;
  property?: Property;
}
