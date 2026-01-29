
export type Property = {
  id:string;
  title: string;
  tagline: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  description: string;
  images: { url: string; alt: string }[];
  location: string;
  amenities: string[];
  agent: {
    name: string;
    avatarUrl: string;
  },
  latitude: number;
  longitude: number;
};
