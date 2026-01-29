import type { Contact, Property, Task, SalesData, LeadSourceData } from './types';

export const contacts: Contact[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.d@example.com',
    phone: '555-123-4567',
    status: 'Client',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    lastContacted: '2024-05-20',
    notes: 'Looking for a 3-bedroom house in the suburbs. Budget is around $500k.',
    interactionHistory: [
        { id: 'i1', type: 'Email', date: '2024-05-20', notes: 'Sent initial list of properties.'},
        { id: 'i2', type: 'Call', date: '2024-05-22', notes: 'Discussed property feedback.'},
    ]
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.s@example.com',
    phone: '555-987-6543',
    status: 'Lead',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026705d',
    lastContacted: '2024-05-28',
    notes: 'Interested in downtown condos. Just starting her search.',
    interactionHistory: [
        { id: 'i3', type: 'Email', date: '2024-05-28', notes: 'Initial contact from website form.'},
    ]
  },
  {
    id: '3',
    name: 'Michael Johnson',
    email: 'mike.j@example.com',
    phone: '555-234-5678',
    status: 'Client',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026706d',
    lastContacted: '2024-05-15',
    notes: 'Sold his old house, now looking to downsize. Prefers a single-story home.',
    interactionHistory: []
  },
    {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.d@example.com',
    phone: '555-345-6789',
    status: 'Partner',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026707d',
    lastContacted: '2024-05-25',
    notes: 'Mortgage broker at City Bank. Great to work with.',
    interactionHistory: []
  },
];

export const properties: Property[] = [
  {
    id: 'p1',
    address: '123 Maple St, Springfield',
    price: 450000,
    bedrooms: 3,
    bathrooms: 2.5,
    squareFootage: 2200,
    description: 'Charming suburban home with a large backyard. Perfect for families. Recently renovated kitchen and hardwood floors throughout.',
    imageUrl: 'https://picsum.photos/seed/1/600/400',
    imageHint: 'suburban home',
    type: 'House',
    status: 'For Sale',
  },
  {
    id: 'p2',
    address: '456 Oak Ave, Metropolis',
    price: 650000,
    bedrooms: 2,
    bathrooms: 2,
    squareFootage: 1500,
    description: 'Modern condo in the heart of downtown. Features a rooftop terrace, gym, and stunning city views.',
    imageUrl: 'https://picsum.photos/seed/2/600/400',
    imageHint: 'modern condo',
    type: 'Condo',
    status: 'For Sale',
  },
  {
    id: 'p3',
    address: '789 Pine Ln, Greenfield',
    price: 320000,
    bedrooms: 4,
    bathrooms: 3,
    squareFootage: 2800,
    description: 'Spacious family house in a quiet neighborhood. Close to parks and excellent schools. Needs some TLC.',
    imageUrl: 'https://picsum.photos/seed/3/600/400',
    imageHint: 'family house',
    type: 'House',
    status: 'Sold',
  },
  {
    id: 'p4',
    address: '101 Elm Ct, Central City',
    price: 280000,
    bedrooms: 1,
    bathrooms: 1,
    squareFootage: 900,
    description: 'Bright and airy top-floor apartment with a balcony. Ideal for a young professional.',
    imageUrl: 'https://picsum.photos/seed/4/600/400',
    imageHint: 'bright apartment',
    type: 'Apartment',
    status: 'Pending',
  },
];

export const tasks: Task[] = [
  {
    id: 't1',
    title: 'Follow up with Jane Smith',
    dueDate: '2024-06-05',
    completed: false,
    contactId: '2',
    contactName: 'Jane Smith',
  },
  {
    id: 't2',
    title: 'Schedule showing for John Doe at 123 Maple St',
    dueDate: '2024-06-02',
    completed: false,
    contactId: '1',
    contactName: 'John Doe',
  },
  {
    id: 't3',
    title: 'Prepare closing documents for 789 Pine Ln',
    dueDate: '2024-05-30',
    completed: true,
  },
  {
    id: 't4',
    title: 'Send market report to Michael Johnson',
    dueDate: '2024-06-07',
    completed: false,
    contactId: '3',
    contactName: 'Michael Johnson',
  },
];


export const salesData: SalesData[] = [
    { month: 'Jan', sales: 2 },
    { month: 'Feb', sales: 3 },
    { month: 'Mar', sales: 5 },
    { month: 'Apr', sales: 4 },
    { month: 'May', sales: 7 },
    { month: 'Jun', sales: 6 },
];

export const leadSourceData: LeadSourceData[] = [
    { source: 'Website', count: 45, fill: 'var(--color-chart-1)' },
    { source: 'Referral', count: 30, fill: 'var(--color-chart-2)' },
    { source: 'Ad Campaign', count: 15, fill: 'var(--color-chart-3)' },
    { source: 'Social Media', count: 10, fill: 'var(--color-chart-4)' },
];
