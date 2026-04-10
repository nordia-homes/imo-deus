import { adminDb } from '@/firebase/admin';

type PlatformRole = 'admin' | 'agent' | 'platform_admin';

type AgencyRecord = {
  id: string;
  name: string;
  ownerId?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
};

type UserRecord = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  role?: PlatformRole;
  createdAt?: string;
};

export type MasterAdminAgencySummary = {
  id: string;
  name: string;
  ownerId?: string;
  ownerName: string;
  ownerEmail: string;
  contactEmail: string;
  contactPhone: string;
  adminCount: number;
  agentCount: number;
  propertiesCount: number;
  contactsCount: number;
  createdAt: string | null;
};

export type MasterAdminUserSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: PlatformRole | 'unknown';
  agencyId: string | null;
  agencyName: string;
  createdAt: string | null;
};

export type MasterAdminPropertySummary = {
  id: string;
  title: string;
  agencyId: string;
  agencyName: string;
  agentId: string | null;
  agentName: string;
  status: string;
  price: number;
  city: string;
  location: string;
  createdAt: string | null;
};

export type MasterAdminLeadSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  agencyId: string;
  agencyName: string;
  agentId: string | null;
  agentName: string;
  status: string;
  source: string;
  budget: number;
  city: string;
  zone: string;
  notes: string;
  createdAt: string | null;
};

export type MasterAdminAgencyDetail = {
  agency: MasterAdminAgencySummary;
  agents: MasterAdminUserSummary[];
  properties: MasterAdminPropertySummary[];
  leads: MasterAdminLeadSummary[];
  stats: {
    totalUsers: number;
    adminCount: number;
    agentCount: number;
    propertiesCount: number;
    activePropertiesCount: number;
    leadsCount: number;
    wonLeadsCount: number;
    activeLeadsCount: number;
    totalPortfolioValue: number;
    totalLeadBudget: number;
  };
};

type PlatformDataset = {
  agencies: AgencyRecord[];
  users: UserRecord[];
  usersByAgencyId: Map<string, UserRecord[]>;
  usersById: Map<string, UserRecord>;
  agenciesById: Map<string, AgencyRecord>;
};

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function getPlatformDataset(): Promise<PlatformDataset> {
  const [agenciesSnapshot, usersSnapshot] = await Promise.all([
    adminDb.collection('agencies').get(),
    adminDb.collection('users').get(),
  ]);

  const agencies = agenciesSnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<AgencyRecord, 'id'>),
  }));

  const users = usersSnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<UserRecord, 'id'>),
  }));

  const usersByAgencyId = new Map<string, UserRecord[]>();
  const usersById = new Map<string, UserRecord>();
  const agenciesById = new Map<string, AgencyRecord>();

  agencies.forEach((agency) => {
    agenciesById.set(agency.id, agency);
  });

  users.forEach((user) => {
    usersById.set(user.id, user);
    if (!user.agencyId) return;
    const current = usersByAgencyId.get(user.agencyId) || [];
    current.push(user);
    usersByAgencyId.set(user.agencyId, current);
  });

  return {
    agencies,
    users,
    usersByAgencyId,
    usersById,
    agenciesById,
  };
}

export async function listMasterAdminAgencies(): Promise<MasterAdminAgencySummary[]> {
  const dataset = await getPlatformDataset();

  const results = await Promise.all(
    dataset.agencies.map(async (agency) => {
      const agencyUsers = dataset.usersByAgencyId.get(agency.id) || [];
      const owner = agency.ownerId ? dataset.usersById.get(agency.ownerId) : undefined;

      const [propertiesSnapshot, contactsSnapshot] = await Promise.all([
        adminDb.collection('agencies').doc(agency.id).collection('properties').get(),
        adminDb.collection('agencies').doc(agency.id).collection('contacts').get(),
      ]);

      return {
        id: agency.id,
        name: safeString(agency.name, 'Agenție fără nume'),
        ownerId: agency.ownerId,
        ownerName: safeString(owner?.name, 'Nedefinit'),
        ownerEmail: safeString(owner?.email, 'Nedisponibil'),
        contactEmail: safeString(agency.email, 'Nedisponibil'),
        contactPhone: safeString(agency.phone, 'Nedisponibil'),
        adminCount: agencyUsers.filter((user) => user.role === 'admin').length,
        agentCount: agencyUsers.filter((user) => user.role === 'agent').length,
        propertiesCount: propertiesSnapshot.size,
        contactsCount: contactsSnapshot.size,
        createdAt: agency.createdAt || null,
      } satisfies MasterAdminAgencySummary;
    })
  );

  return results.sort((left, right) => left.name.localeCompare(right.name, 'ro'));
}

export async function listMasterAdminUsers(): Promise<MasterAdminUserSummary[]> {
  const dataset = await getPlatformDataset();

  return dataset.users
    .map((user) => {
      const agency = user.agencyId ? dataset.agenciesById.get(user.agencyId) : undefined;
      return {
        id: user.id,
        name: safeString(user.name, 'Utilizator fără nume'),
        email: safeString(user.email, 'Nedisponibil'),
        phone: safeString(user.phone, 'Nedisponibil'),
        role: user.role || 'unknown',
        agencyId: user.agencyId || null,
        agencyName: agency?.name || (user.role === 'platform_admin' ? 'Platformă' : 'Fără agenție'),
        createdAt: user.createdAt || null,
      } satisfies MasterAdminUserSummary;
    })
    .sort((left, right) => {
      if (left.role === 'platform_admin' && right.role !== 'platform_admin') return -1;
      if (left.role !== 'platform_admin' && right.role === 'platform_admin') return 1;
      return left.name.localeCompare(right.name, 'ro');
    });
}

export async function listMasterAdminProperties(): Promise<MasterAdminPropertySummary[]> {
  const dataset = await getPlatformDataset();

  const nestedResults = await Promise.all(
    dataset.agencies.map(async (agency) => {
      const propertiesSnapshot = await adminDb.collection('agencies').doc(agency.id).collection('properties').get();
      return propertiesSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as {
          title?: string;
          agentId?: string | null;
          agentName?: string | null;
          status?: string;
          price?: number;
          city?: string;
          location?: string;
          createdAt?: string;
        };
        const agent = data.agentId ? dataset.usersById.get(data.agentId) : undefined;

        return {
          id: docSnapshot.id,
          title: safeString(data.title, 'Proprietate fără titlu'),
          agencyId: agency.id,
          agencyName: safeString(agency.name, 'Agenție fără nume'),
          agentId: data.agentId || null,
          agentName: safeString(data.agentName, safeString(agent?.name, 'Neatribuit')),
          status: safeString(data.status, 'Nedefinit'),
          price: safeNumber(data.price, 0),
          city: safeString(data.city),
          location: safeString(data.location),
          createdAt: data.createdAt || null,
        } satisfies MasterAdminPropertySummary;
      });
    })
  );

  return nestedResults
    .flat()
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
}

export async function listMasterAdminLeads(): Promise<MasterAdminLeadSummary[]> {
  const dataset = await getPlatformDataset();

  const nestedResults = await Promise.all(
    dataset.agencies.map(async (agency) => {
      const contactsSnapshot = await adminDb.collection('agencies').doc(agency.id).collection('contacts').get();
      return contactsSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as {
          name?: string;
          email?: string;
          phone?: string;
          agentId?: string | null;
          agentName?: string | null;
          status?: string;
          source?: string;
          budget?: number;
          city?: string;
          zones?: string[];
          generalZone?: string | null;
          description?: string;
          createdAt?: string;
        };
        const agent = data.agentId ? dataset.usersById.get(data.agentId) : undefined;
        const primaryZone = Array.isArray(data.zones) && data.zones.length
          ? data.zones.join(', ')
          : safeString(data.generalZone, '');

        return {
          id: docSnapshot.id,
          name: safeString(data.name, 'Lead fără nume'),
          email: safeString(data.email, 'Nedisponibil'),
          phone: safeString(data.phone, 'Nedisponibil'),
          agencyId: agency.id,
          agencyName: safeString(agency.name, 'Agenție fără nume'),
          agentId: data.agentId || null,
          agentName: safeString(data.agentName, safeString(agent?.name, 'Neatribuit')),
          status: safeString(data.status, 'Nedefinit'),
          source: safeString(data.source, 'Nespecificat'),
          budget: safeNumber(data.budget, 0),
          city: safeString(data.city, 'Nespecificat'),
          zone: primaryZone || 'Nespecificată',
          notes: safeString(data.description, ''),
          createdAt: data.createdAt || null,
        } satisfies MasterAdminLeadSummary;
      });
    })
  );

  return nestedResults
    .flat()
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
}

export async function getMasterAdminOverview() {
  const [agencies, users, properties, leads] = await Promise.all([
    listMasterAdminAgencies(),
    listMasterAdminUsers(),
    listMasterAdminProperties(),
    listMasterAdminLeads(),
  ]);

  const sortedByActivity = [...agencies].sort((left, right) => {
    const leftActivity = left.propertiesCount + left.contactsCount + left.agentCount + left.adminCount;
    const rightActivity = right.propertiesCount + right.contactsCount + right.agentCount + right.adminCount;
    if (leftActivity !== rightActivity) return rightActivity - leftActivity;
    return left.name.localeCompare(right.name, 'ro');
  });

  return {
    totals: {
      agencies: agencies.length,
      users: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      agents: users.filter((user) => user.role === 'agent').length,
      platformAdmins: users.filter((user) => user.role === 'platform_admin').length,
      properties: properties.length,
      contacts: leads.length,
    },
    agencies,
    topAgencies: sortedByActivity.slice(0, 5),
  };
}

export async function getMasterAdminAgencyDetail(agencyId: string): Promise<MasterAdminAgencyDetail | null> {
  const [agencies, users, properties, leads] = await Promise.all([
    listMasterAdminAgencies(),
    listMasterAdminUsers(),
    listMasterAdminProperties(),
    listMasterAdminLeads(),
  ]);

  const agency = agencies.find((entry) => entry.id === agencyId);
  if (!agency) return null;

  const agents = users.filter((entry) => entry.agencyId === agencyId);
  const agencyProperties = properties.filter((entry) => entry.agencyId === agencyId);
  const agencyLeads = leads.filter((entry) => entry.agencyId === agencyId);

  return {
    agency,
    agents,
    properties: agencyProperties,
    leads: agencyLeads,
    stats: {
      totalUsers: agents.length,
      adminCount: agents.filter((entry) => entry.role === 'admin').length,
      agentCount: agents.filter((entry) => entry.role === 'agent').length,
      propertiesCount: agencyProperties.length,
      activePropertiesCount: agencyProperties.filter((entry) => entry.status === 'Activ').length,
      leadsCount: agencyLeads.length,
      wonLeadsCount: agencyLeads.filter((entry) => entry.status === 'Câștigat').length,
      activeLeadsCount: agencyLeads.filter((entry) => !['Câștigat', 'Pierdut'].includes(entry.status)).length,
      totalPortfolioValue: agencyProperties.reduce((sum, entry) => sum + entry.price, 0),
      totalLeadBudget: agencyLeads.reduce((sum, entry) => sum + entry.budget, 0),
    },
  };
}
