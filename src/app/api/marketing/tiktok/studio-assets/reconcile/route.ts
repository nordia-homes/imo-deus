import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { listTikTokPortfolioProperties, listTikTokStudioAssets, listTikTokStudioProjects } from '@/lib/tiktok-marketing';
import { inferTikTokAssetProperty } from '@/lib/tiktok-asset-association';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export async function POST(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Asocierea nu este disponibilă în demo.');
    const [properties, projects, assets] = await Promise.all([listTikTokPortfolioProperties(agencyId), listTikTokStudioProjects(agencyId), listTikTokStudioAssets(agencyId)]);
    const collection = adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioAssets');
    let linked = 0;
    for (const asset of assets) {
      if (asset.propertyId || (role === 'agent' && asset.ownerUid !== uid)) continue;
      const propertyId = inferTikTokAssetProperty(asset, properties, projects);
      if (!propertyId) continue;
      const changed = await adminDb.runTransaction(async tx => {
        const current = await tx.get(collection.doc(asset.id));
        const property = await tx.get(adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId));
        const data = current.data();
        if (!property.exists || !data || data.propertyId || data.agencyId !== agencyId || data.url !== asset.url || (role === 'agent' && data.ownerUid !== uid)) return false;
        tx.update(current.ref, { propertyId, updatedAt: new Date().toISOString() });
        return true;
      });
      if (changed) linked++;
    }
    return NextResponse.json({ linked });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Asocierile nu au putut fi verificate.' }, { status: 400 });
  }
}
