export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  noShowCount: number;
  updatedAt: string;
}

export interface ActivityLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  startTime: any; // Firestore Timestamp
  location: ActivityLocation;
  creatorId: string;
  creatorName: string;
  status: 'active' | 'completed' | 'cancelled' | 'archived';
  createdAt: any;
}

export interface Participant {
  uid: string;
  displayName: string;
  photoURL: string;
  status: 'joined' | 'no-show' | 'arrived';
  location?: {
    lat: number;
    lng: number;
  };
  joinedAt: any;
  updatedAt: any;
}
