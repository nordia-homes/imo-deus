import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;

const projectId = 'demo-imodeus-tiktok-ads';
const organizationA = 'org-a';
const organizationB = 'org-b';
const userA = 'user-a';

const serverManagedCollections = [
  'tiktokWorkspaceDrafts',
  'tiktokStudioProjects',
  'tiktokStudioAssets',
  'tiktokPostDrafts',
  'tiktokAdvertisers',
  'tiktokAccountPermissions',
  'tiktokResourceReferences',
  'tiktokCapabilityStates',
  'tiktokMcpToolSchemas',
  'tiktokSpendAuthorizations',
  'tiktokOperationLedger',
  'tiktokMutationLocks',
  'tiktokAuditEvents',
  'tiktokLeadReferences',
  'tiktokMediaMappings',
  'tiktokReportSnapshots',
  'tiktokReportingState',
  'tiktokRateLimitState',
  'tiktokSyncState',
] as const;

describeWithEmulator('TikTok Ads Firestore Rules integration', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'src/firestore.rules'), 'utf8'),
      },
    });

    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'users', userA), {
        agencyId: organizationA,
        role: 'admin',
      });
      await setDoc(doc(firestore, 'agencies', organizationA, 'properties', 'property-a'), {
        status: 'Inactiv',
      });
      await setDoc(doc(firestore, 'agencies', organizationB, 'properties', 'property-b'), {
        status: 'Inactiv',
      });

      for (const collectionName of serverManagedCollections) {
        await setDoc(doc(firestore, 'agencies', organizationA, collectionName, 'resource-a'), {
          organizationId: organizationA,
        });
        await setDoc(doc(firestore, 'agencies', organizationB, collectionName, 'resource-b'), {
          organizationId: organizationB,
        });
      }

      await setDoc(doc(firestore, 'agencyPrivateIntegrations', organizationA), { encrypted: true });
      await setDoc(doc(firestore, 'tiktokAdsOauthStates', 'state-a'), { organizationId: organizationA });
      await setDoc(doc(firestore, 'tiktokMcpOAuthClients', 'client-a'), { encrypted: true });
      await setDoc(doc(firestore, 'tiktokAdsJobs', 'job-a'), { organizationId: organizationA });
    });
  });

  afterAll(async () => {
    await environment?.cleanup();
  });

  it('allows an authenticated member to read only ordinary data from their organization', async () => {
    const firestore = environment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(firestore, 'agencies', organizationA, 'properties', 'property-a')));
    await assertFails(getDoc(doc(firestore, 'agencies', organizationB, 'properties', 'property-b')));
  });

  it('denies client access to every tenant-scoped TikTok server-managed collection', async () => {
    const firestore = environment.authenticatedContext(userA).firestore();

    for (const collectionName of serverManagedCollections) {
      await assertFails(getDoc(doc(firestore, 'agencies', organizationA, collectionName, 'resource-a')));
      await assertFails(getDocs(collection(firestore, 'agencies', organizationA, collectionName)));
      await assertFails(setDoc(doc(firestore, 'agencies', organizationA, collectionName, 'client-write'), {
        organizationId: organizationA,
      }));
      await assertFails(getDoc(doc(firestore, 'agencies', organizationB, collectionName, 'resource-b')));
    }
  });

  it('denies authenticated and unauthenticated clients access to global TikTok secrets and jobs', async () => {
    const authenticated = environment.authenticatedContext(userA).firestore();
    const unauthenticated = environment.unauthenticatedContext().firestore();
    const privatePaths = [
      ['agencyPrivateIntegrations', organizationA],
      ['tiktokAdsOauthStates', 'state-a'],
      ['tiktokMcpOAuthClients', 'client-a'],
      ['tiktokAdsJobs', 'job-a'],
      ['tiktokStudioJobs', 'job-a'],
    ] as const;

    for (const [collectionName, documentId] of privatePaths) {
      await assertFails(getDoc(doc(authenticated, collectionName, documentId)));
      await assertFails(getDoc(doc(unauthenticated, collectionName, documentId)));
      await assertFails(setDoc(doc(authenticated, collectionName, `write-${documentId}`), { compromised: true }));
    }
  });

  it('keeps Admin SDK writes possible through the rules-disabled server context', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const reference = doc(context.firestore(), 'agencies', organizationA, 'tiktokSyncState', 'server-write');
      await expect(setDoc(reference, { organizationId: organizationA })).resolves.toBeUndefined();
      await expect(getDoc(reference)).resolves.toMatchObject({ exists: expect.any(Function) });
    });
  });
});
