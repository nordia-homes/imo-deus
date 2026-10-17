import { createHash, randomUUID } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
type Page = {
    data?: Record<string, unknown>[];
    paging?: {
        next?: string;
        cursors?: {
            after?: string;
        };
    };
};
export async function ensureMetaImageUpload(options: {
    ref: DocumentReference;
    accountId: string;
    imageUrl: string;
    guard: (tx: Transaction) => Promise<void>;
    download: () => Promise<{
        bytes: Buffer;
        mime: string;
        extension: string;
    }>;
    upload: (image: {
        bytes: Buffer;
        mime: string;
    }, name: string) => Promise<string | null>;
    list: (name: string, after?: string) => Promise<Page>;
}) {
    const { ref, imageUrl } = options, accountId = options.accountId.replace(/^act_/, '');
    const read = async () => ref.firestore.runTransaction(async (tx) => { await options.guard(tx); return (await tx.get(ref)).data()!; });
    const previous = await read();
    if (previous.imageHash)
        return String(previous.imageHash);
    if (previous.uploadStartedAt && !previous.imageUploadIntent)
        throw Error('Încărcarea veche nu are identificator de recuperare. Nu retrimit.');
    let intent = previous.imageUploadIntent as {
        name: string;
        accountId: string;
        imageUrl: string;
        sha256: string;
    } | undefined;
    if (!intent) {
        const image = await options.download(), sha256 = createHash('sha256').update(image.bytes).digest('hex');
        const claimed = await ref.firestore.runTransaction(async (tx) => {
            await options.guard(tx);
            const current = (await tx.get(ref)).data()!;
            if (current.imageUploadIntent)
                return { dispatch: false, intent: current.imageUploadIntent };
            if (current.uploadStartedAt)
                throw Error('Încărcare veche fără dovadă de corelare.');
            const value = { name: 'imo_' + randomUUID() + '.' + image.extension, accountId, imageUrl, sha256, state: 'pending', startedAt: new Date().toISOString() };
            tx.update(ref, { imageUploadIntent: value });
            return { dispatch: true, intent: value };
        });
        intent = claimed.intent;
        if (claimed.dispatch) {
            await read();
            let imageHash: string | null = null;
            try {
                imageHash = await options.upload(image, intent!.name);
            }
            catch { /* Recover the named upload without repeating the POST. */ }
            if (typeof imageHash === 'string' && imageHash.length > 0) {
                await ref.firestore.runTransaction(async (tx) => { await options.guard(tx); const current = (await tx.get(ref)).data()!; if (current.imageUploadIntent?.name !== intent!.name || current.imageHash && current.imageHash !== imageHash)
                    throw Error('Încărcare schimbată.'); tx.update(ref, { imageHash, uploadedImageUrl: imageUrl, 'imageUploadIntent.state': 'resolved', 'imageUploadIntent.hash': imageHash }); });
                return imageHash;
            }
        }
    }
    if (!intent || intent.accountId !== accountId || intent.imageUrl !== imageUrl || !/^imo_[a-f0-9-]+\.(jpg|png|webp)$/.test(intent.name))
        throw Error('Încărcarea nu corespunde propunerii.');
    const matches = new Set<string>(), seen = new Set<string>();
    let after: string | undefined, complete = false;
    const deadline = Date.now() + 25000;
    for (let page = 0; page < 20 && Date.now() < deadline; page++) {
        await read();
        const result = await options.list(intent.name, after);
        if (!Array.isArray(result.data))
            throw Error('Biblioteca Meta nu poate fi verificată.');
        for (const row of result.data) {
            if (row.name !== intent.name)
                continue;
            if (row.account_id !== accountId || row.status !== 'ACTIVE' || typeof row.hash !== 'string' || !row.hash)
                throw Error('Imagine Meta neconfirmată.');
            matches.add(row.hash);
        }
        if (!result.paging?.next) {
            complete = true;
            break;
        }
        const cursor = result.paging.cursors?.after;
        if (!cursor || seen.has(cursor))
            throw Error('Paginare Meta neconfirmată.');
        seen.add(cursor);
        after = cursor;
    }
    if (!complete || matches.size !== 1)
        throw Error('Imaginea nu este încă identificată fără ambiguitate la Meta. Reia verificarea fără reîncărcare.');
    const imageHash = [...matches][0];
    await ref.firestore.runTransaction(async (tx) => { await options.guard(tx); const current = (await tx.get(ref)).data()!; if (current.imageUploadIntent?.name !== intent!.name || current.imageHash && current.imageHash !== imageHash)
        throw Error('Încărcare schimbată.'); tx.update(ref, { imageHash, uploadedImageUrl: imageUrl, 'imageUploadIntent.state': 'resolved', 'imageUploadIntent.hash': imageHash, 'imageUploadIntent.reconciledAt': new Date().toISOString() }); });
    return imageHash;
}
