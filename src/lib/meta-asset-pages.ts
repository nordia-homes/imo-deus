/** Read only fixed Meta asset edges; never follow provider-supplied URLs. */
export async function readMetaAssetPages<T>(path: string, accessToken: string): Promise<T[]> {
    const base = new URL('https://graph.facebook.com/v23.0' + path);
    if (!['/v23.0/me/businesses', '/v23.0/me/adaccounts', '/v23.0/me/accounts'].includes(base.pathname))
        throw Error('Asset edge invalid');
    const rows: T[] = [], seen = new Set<string>(), deadline = Date.now() + 30000;
    let after: string | undefined;
    for (let page = 0; page < 100; page++) {
        if (Date.now() >= deadline)
            throw Error('Asset listing incomplete');
        const url = new URL(base);
        if (after)
            url.searchParams.set('after', after);
        const response = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))) });
        if (!response.ok)
            throw Error('Meta asset listing unavailable');
        const payload = await response.json();
        if (!payload || payload.error || !Array.isArray(payload.data) || payload.data.some((row: any) => !row || typeof row.id !== 'string' || !/^(act_)?[0-9]+$/.test(row.id)))
            throw Error('Meta asset response invalid');
        for (const row of payload.data) {
            const account = base.pathname.endsWith('/adaccounts');
            if (!(account ? /^act_[0-9]+$/ : /^[0-9]+$/).test(row.id))
                throw Error('Meta asset identity invalid');
            for (const key of ['name', 'account_id', 'currency', 'timezone_name'])
                if (row[key] != null && typeof row[key] !== 'string')
                    throw Error('Meta asset field invalid');
            if (account && row.account_id && row.id !== 'act_' + row.account_id)
                throw Error('Meta account identity mismatch');
            const ig = row.instagram_business_account;
            if (ig != null && (typeof ig !== 'object' || !/^[0-9]+$/.test(ig.id) || typeof ig.id !== 'string' || [ig.name, ig.username].some(v => v != null && typeof v !== 'string')))
                throw Error('Meta Instagram invalid');
        }
        rows.push(...payload.data);
        if (!payload.paging?.next) {
            if (new Set(rows.map((row: any) => row.id)).size !== rows.length)
                throw Error('Duplicate Meta asset');
            return rows;
        }
        const cursor = payload.paging?.cursors?.after;
        if (typeof cursor !== 'string' || !cursor || cursor.length > 4096 || seen.has(cursor))
            throw Error('Meta asset pagination incomplete');
        seen.add(cursor);
        after = cursor;
    }
    throw Error('Meta asset pagination limit reached');
}
