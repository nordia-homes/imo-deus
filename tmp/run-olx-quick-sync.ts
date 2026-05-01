import { config as loadEnv } from 'dotenv';
import Module from 'node:module';
import path from 'node:path';

loadEnv({ path: '.env.local' });

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const mappedRequest = path.join(process.cwd(), 'src', request.slice(2));
    return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

async function main() {
  const { runOwnerListingsBackgroundSync } = await import('../src/lib/owner-listings/background');
  const { adminDb } = await import('../src/firebase/admin');

  const result = await runOwnerListingsBackgroundSync({
    scopeKey: 'bucuresti-ilfov',
    sources: ['olx'],
    maxPages: 1,
    hardPageLimit: 1,
  });

  const sample = await adminDb
    .collection('ownerListings')
    .orderBy('lastSeenAt', 'desc')
    .limit(40)
    .get();

  console.log(
    JSON.stringify(
      {
        result,
        sample: sample.docs
          .map((doc) => ({
          id: doc.id,
          title: doc.data().title,
          location: doc.data().location,
          price: doc.data().price,
          link: doc.data().link,
          source: doc.data().source,
          isBaselineListing: doc.data().isBaselineListing,
          isNew: doc.data().isNew,
          }))
          .filter((item) => item.source === 'olx')
          .slice(0, 8),
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
