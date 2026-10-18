import { createHash } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type PropertyPostProvider = {
    upload: (url: string, caption: string) => Promise<unknown>;
    create: (message: string, photoIds: string[]) => Promise<unknown>;
    read: (id: string) => Promise<any>;
    list: (after?: string) => Promise<any>;
};
const postId = (value: unknown, pageId: string) => typeof value === 'string' && new RegExp('^' + pageId + '_[0-9]+$').test(value);
export function verifyPropertyPost(raw: any, expected: {
    pageId: string;
    postId: string;
    message: string;
    photoIds: string[];
    destinationUrl?: string;
}) {
    if (!/^[0-9]+$/.test(expected.pageId) || !postId(expected.postId, expected.pageId) || raw?.id !== expected.postId || raw?.from?.id !== expected.pageId || raw?.is_published !== true || raw?.message !== expected.message)
        throw Error('Postarea nu este confirmată pe pagina și cu textul cerut.');
    if (!expected.photoIds.length) {
        if (!expected.destinationUrl || raw.link !== expected.destinationUrl)
            throw Error('Destinația postării nu este confirmată.');
    }
    const attachments = raw.attachments;
    if (expected.photoIds.length && (!Array.isArray(attachments?.data) || attachments.paging?.next))
        throw Error('Materialele postării nu sunt complete.');
    const ids: string[] = [];
    for (const item of expected.photoIds.length ? attachments.data : []) {
        if (item.subattachments) {
            if (!Array.isArray(item.subattachments.data) || item.subattachments.paging?.next)
                throw Error('Fotografiile postării nu sunt complete.');
            for (const child of item.subattachments.data)
                ids.push(child?.target?.id);
        }
        else
            ids.push(item?.target?.id);
    }
    if (ids.length !== expected.photoIds.length || new Set(ids).size !== ids.length || ids.some((id, index) => id !== expected.photoIds[index]))
        throw Error('Fotografiile sau ordinea lor nu sunt confirmate.');
    let permalink: URL;
    try {
        permalink = new URL(raw.permalink_url);
    }
    catch {
        throw Error('Lipsește legătura verificabilă a postării.');
    }
    if (permalink.protocol !== 'https:' || !['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(permalink.hostname) || permalink.username || permalink.password)
        throw Error('Legătura postării este invalidă.');
    return { postId: raw.id as string, pageId: expected.pageId, message: expected.message, photoIds: [...ids], permalinkUrl: permalink.toString(), checkedAt: new Date().toISOString(), publishedConfirmed: true as const };
}
/** Durable intent before each write. Uncertain photo uploads are never redispatched. */
export async function publishVerifiedPropertyGallery(options: {
    propertyRef: DocumentReference;
    grantRef: DocumentReference;
    memberRef: DocumentReference;
    agencyId: string;
    uid: string;
    pageId: string;
    pageName: string | null;
    message: string;
    destinationUrl: string;
    images: {
        url: string;
        alt: string;
    }[];
    property: Record<string, any>;
    grant: Record<string, any>;
    provider: PropertyPostProvider;
}) {
    const o = options, content = (row: Record<string, any>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'metaFacebookPost'));
    if (!/^[0-9]+$/.test(o.pageId) || !o.destinationUrl.startsWith('https://') || o.images.length > 10 || o.images.some(i => !i.url.startsWith('https://')))
        throw Error('Galerie invalidă pentru publicare verificată.');
    const expectedProperty = hash(content(o.property)), expectedGrant = hash(o.grant), requestHash = hash({ pageId: o.pageId, message: o.message, destinationUrl: o.destinationUrl, images: o.images, property: expectedProperty }), ref = o.propertyRef.collection('metaPostExecutions').doc(requestHash), db = ref.firestore;
    const guard = async (tx: Transaction) => { const [p, g, m] = await Promise.all([tx.get(o.propertyRef), tx.get(o.grantRef), tx.get(o.memberRef)]); const row = p.data(); if (!row || row.deletedAt || row.agencyId && row.agencyId !== o.agencyId || hash(content(row)) !== expectedProperty || !g.exists || hash(g.data()) !== expectedGrant || g.data()?.agencyId !== o.agencyId || g.data()?.connected !== true || m.data()?.agencyId !== o.agencyId || m.data()?.role !== 'admin')
        throw Error('Proprietatea, conexiunea sau accesul s-a schimbat.'); };
    const saved = await db.runTransaction(async (tx) => { await guard(tx); const state = await tx.get(ref); if (!state.exists) {
        const pending = await tx.get(o.propertyRef.collection('metaPostExecutions').where('state', '==', 'pending'));
        if (!pending.empty)
            throw Error('Există o publicare incertă pentru proprietate.');
        if (o.property.metaFacebookPost?.status === 'publishing')
            throw Error('Publicare anterioară incertă; nu o repet automat.');
        tx.create(ref, { requestHash, state: 'pending', pageId: o.pageId, createdAt: new Date().toISOString() });
    } return state.data(); });
    if (saved?.state === 'completed') {
        await db.runTransaction(async (tx) => { await guard(tx); const p = await tx.get(o.propertyRef); if (p.data()?.metaFacebookPost?.postId !== saved.post.postId)
            throw Error('Postarea CRM s-a schimbat.'); });
        return saved.post;
    }
    const step = async (name: string, dispatch: () => Promise<unknown>, isValid: (id: unknown) => boolean, recover?: () => Promise<string>) => {
        const stepRef = ref.collection('steps').doc(name);
        const claim = await db.runTransaction(async (tx) => { await guard(tx); const current = await tx.get(stepRef); if (current.exists)
            return { send: false, id: current.data()?.id }; tx.create(stepRef, { state: 'pending', createdAt: new Date().toISOString() }); return { send: true, id: null }; });
        let id = claim.id;
        if (!id && claim.send) {
            try {
                await db.runTransaction(guard);
                const response: any = await dispatch();
                const candidate = response?.id || response?.post_id;
                if (isValid(candidate))
                    id = candidate;
            }
            catch { /* An uncertain write is not repeated. */ }
        }
        if (!id && recover)
            id = await recover();
        if (!isValid(id))
            throw Error('Rezultatul etapei de publicare este incert. Nu retrimit operația.');
        await db.runTransaction(async (tx) => { await guard(tx); const current = await tx.get(stepRef); if (!current.exists || current.data()?.id && current.data()?.id !== id)
            throw Error('Etapa publicării s-a schimbat.'); tx.update(stepRef, { state: 'resolved', id, resolvedAt: new Date().toISOString() }); });
        return String(id);
    };
    const photoIds: string[] = [];
    for (let i = 0; i < o.images.length; i++)
        photoIds.push(await step('photo_' + i, () => o.provider.upload(o.images[i].url, o.images[i].alt), id => typeof id === 'string' && /^[0-9]+$/.test(id)));
    if (new Set(photoIds).size !== photoIds.length)
        throw Error('Meta a returnat fotografii duplicate.');
    const recover = async () => { if (!photoIds.length)
        throw Error('Postare cu link incertă; nu o repet fără identificator.'); const matches = new Set<string>(), seen = new Set<string>(); let after: string | undefined, complete = false; const deadline = Date.now() + 25000; for (let page = 0; page < 20 && Date.now() < deadline; page++) {
        await db.runTransaction(guard);
        const result = await o.provider.list(after);
        if (result?.error || !Array.isArray(result?.data))
            throw Error('Lista postărilor nu este confirmată.');
        for (const row of result.data) {
            if (row?.message !== o.message || !postId(row?.id, o.pageId))
                continue;
            try {
                verifyPropertyPost(row, { pageId: o.pageId, postId: row.id, message: o.message, photoIds, destinationUrl: o.destinationUrl });
                matches.add(row.id);
            }
            catch (error) {
                if (!(error instanceof Error) || error.message !== 'Fotografiile sau ordinea lor nu sunt confirmate.')
                    throw error;
            }
        }
        if (!result.paging?.next) {
            complete = true;
            break;
        }
        const cursor = result.paging?.cursors?.after;
        if (typeof cursor !== 'string' || !cursor || seen.has(cursor))
            throw Error('Paginare incompletă a postărilor.');
        seen.add(cursor);
        after = cursor;
    } if (!complete || matches.size !== 1)
        throw Error('Postarea rămâne neconfirmată; nu o public din nou.'); return [...matches][0]; };
    const id = await step('feed', () => o.provider.create(o.message, photoIds), id => postId(id, o.pageId), recover);
    await db.runTransaction(guard);
    const proof = verifyPropertyPost(await o.provider.read(id), { pageId: o.pageId, postId: id, message: o.message, photoIds, destinationUrl: o.destinationUrl });
    const post = { status: 'published' as const, pageId: o.pageId, pageName: o.pageName, postId: id, permalinkUrl: proof.permalinkUrl, photoIds, message: o.message, imageCount: photoIds.length, createdByUid: o.uid, publishedAt: proof.checkedAt, updatedAt: proof.checkedAt, errorMessage: null, providerVerification: proof };
    await db.runTransaction(async (tx) => { await guard(tx); const [current, feed] = await Promise.all([tx.get(ref), tx.get(ref.collection('steps').doc('feed'))]); if (!current.exists || feed.data()?.id !== id)
        throw Error('Intenția publicării s-a schimbat.'); tx.update(o.propertyRef, { metaFacebookPost: post }); tx.update(ref, { state: 'completed', post, completedAt: proof.checkedAt }); });
    return post;
}
