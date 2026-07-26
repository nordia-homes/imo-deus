'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { AiOutreachCallModal } from '@/components/ai-outreach/ai-outreach-call-modal';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import { OlxConnectionBanner } from '@/components/owner-listings/olx-connection-banner';
import type { OwnerListing, OwnerListingFavorite, PropertyTypeFilter, SourceFilterValue, TransactionTypeFilter } from '@/components/owner-listings/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { getAgencyThemePreset } from '@/lib/theme';
import { listOwnerListingScopes, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { Filter, RotateCcw } from 'lucide-react';
import type { AiOutreachCall, AiOutreachOutcome } from '@/lib/ai-outreach/types';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

const LISTINGS_PER_PAGE = 100;
const RESERVATION_TTL_MS = 4 * 60 * 60 * 1000;
type AiStatusFilter = 'all' | 'uncalled' | AiOutreachOutcome;
type DesktopOlxBridgeWindow = Window & {
  imodeusDesktop?: {
    getOlxPhoneNumber?: (input: { url: string }) => Promise<{ phone?: string; message?: string }>;
  };
};

export default function OwnerListingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [roomsFilter, setRoomsFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeFilter>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionTypeFilter>('all');
  const [constructionYearFilter, setConstructionYearFilter] = useState<string>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue | null>(null);
  const [aiStatusFilter, setAiStatusFilter] = useState<AiStatusFilter>('all');
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>('');
  const [hasSelectedScopeManually, setHasSelectedScopeManually] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [selectedAiListing, setSelectedAiListing] = useState<OwnerListing | null>(null);
  const [localAiCalls, setLocalAiCalls] = useState<AiOutreachCall[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const [isLoadingAiDetails, setIsLoadingAiDetails] = useState<string | null>(null);
  const [isUpdatingProspecting, setIsUpdatingProspecting] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageCursor, setPageCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const [totalListingCount, setTotalListingCount] = useState<number | null>(null);
  const [totalMatchingCount, setTotalMatchingCount] = useState<number | null>(null);
  const [availableFavoriteCount, setAvailableFavoriteCount] = useState<number | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const previousPageRef = useRef(currentPage);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency, agencyId, userProfile } = useAgency();
  const isClassicTheme = getAgencyThemePreset(agency) === 'classic';
  const agencyDefaultScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);
  const scopeOptions = useMemo(() => listOwnerListingScopes(), []);
  const currentScope = useMemo(
    () => scopeOptions.find((scope) => scope.key === selectedScopeKey) || agencyDefaultScope || scopeOptions[0] || null,
    [agencyDefaultScope, scopeOptions, selectedScopeKey],
  );
  const currentAgentName = userProfile?.name || user?.displayName || user?.email || 'Agent neatribuit';

  const listingFiltersKey = useMemo(
    () => JSON.stringify({
      scopeKey: currentScope?.key || '',
      searchQuery: appliedSearchQuery,
      roomsFilter,
      propertyTypeFilter,
      transactionTypeFilter,
      constructionYearFilter,
      priceMin,
      priceMax,
      sourceFilter,
    }),
    [appliedSearchQuery, constructionYearFilter, currentScope?.key, priceMax, priceMin, propertyTypeFilter, roomsFilter, sourceFilter, transactionTypeFilter],
  );

  useEffect(() => {
    if (searchQuery === appliedSearchQuery) return;
    const timer = window.setTimeout(() => setAppliedSearchQuery(searchQuery), 500);
    return () => window.clearTimeout(timer);
  }, [appliedSearchQuery, searchQuery]);

  useEffect(() => {
    setPageCursor(null);
    setNextCursor(null);
    setCursorHistory([]);
    setHasMoreListings(false);
    setCurrentPage(1);
    setTotalMatchingCount(null);
  }, [listingFiltersKey]);

  useEffect(() => {
    setListings([]);
    setTotalListingCount(null);
    setTotalMatchingCount(null);
  }, [currentScope?.key]);

  useEffect(() => {
    setTotalListingCount(null);
    setTotalMatchingCount(null);
  }, [sourceFilter]);

  useEffect(() => {
    if (!user || !currentScope?.key) {
      setListings([]);
      setIsLoading(Boolean(currentScope?.key));
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setListingsError(null);

      try {
        const propertyType = propertyTypeFilter === 'apartamente'
          ? 'apartment'
          : propertyTypeFilter === 'case'
            ? 'house'
            : propertyTypeFilter === 'terenuri'
              ? 'land'
              : propertyTypeFilter === 'spatii-comerciale'
                ? 'commercial'
                : 'all';
        const params = new URLSearchParams({
          scopeKey: currentScope.key,
          pageSize: String(LISTINGS_PER_PAGE),
          propertyType,
          transactionType: transactionTypeFilter,
          constructionYear: constructionYearFilter,
        });
        if (pageCursor) params.set('cursor', pageCursor);
        if (sourceFilter) params.set('source', sourceFilter);
        if (roomsFilter !== 'all') params.set('rooms', roomsFilter);
        if (priceMin) params.set('priceMin', priceMin);
        if (priceMax) params.set('priceMax', priceMax);
        if (appliedSearchQuery.trim()) params.set('search', appliedSearchQuery.trim());

        const token = await user.getIdToken();
        const response = await fetch(`/api/owner-listings/query?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          listings?: OwnerListing[];
          nextCursor?: string | null;
          hasMore?: boolean;
          totalAvailableCount?: number;
          totalMatchingCount?: number;
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message || 'Nu am putut incarca anunturile.');

        setListings(Array.isArray(payload.listings) ? payload.listings : []);
        setNextCursor(payload.nextCursor || null);
        setHasMoreListings(Boolean(payload.hasMore && payload.nextCursor));
        setTotalListingCount(
          typeof payload.totalAvailableCount === 'number' ? payload.totalAvailableCount : null,
        );
        setTotalMatchingCount(
          typeof payload.totalMatchingCount === 'number' ? payload.totalMatchingCount : null,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setListings([]);
        setListingsError(error instanceof Error ? error.message : 'Nu am putut incarca anunturile.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [appliedSearchQuery, constructionYearFilter, currentScope?.key, listingFiltersKey, pageCursor, priceMax, priceMin, propertyTypeFilter, roomsFilter, sourceFilter, transactionTypeFilter, user]);

  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites')) : null),
    [agencyId, firestore],
  );
  const aiCallsQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'aiOutreachCalls'), orderBy('createdAt', 'desc')) : null),
    [agencyId, firestore],
  );

  const { data: favorites } = useCollection<OwnerListingFavorite>(favoritesQuery);
  const { data: aiCalls } = useCollection<AiOutreachCall>(aiCallsQuery);

  const activeFavoriteIdsKey = useMemo(
    () => (favorites ?? [])
      .filter((favorite) => favorite.isFavoriteActive !== false)
      .map((favorite) => favorite.ownerListingId || favorite.id)
      .filter(Boolean)
      .sort()
      .join('|'),
    [favorites],
  );

  useEffect(() => {
    if (!user || !agencyId) {
      setAvailableFavoriteCount(null);
      return;
    }

    if (!activeFavoriteIdsKey) {
      setAvailableFavoriteCount(0);
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams();
        if (currentScope?.key) params.set('scopeKey', currentScope.key);
        const response = await fetch(`/api/owner-listings/favorites?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          displayableFavoriteCount?: number;
        };
        if (!response.ok) return;
        setAvailableFavoriteCount(
          typeof payload.displayableFavoriteCount === 'number'
            ? payload.displayableFavoriteCount
            : null,
        );
      } catch {
        if (!controller.signal.aborted) setAvailableFavoriteCount(null);
      }
    })();

    return () => controller.abort();
  }, [activeFavoriteIdsKey, agencyId, currentScope?.key, user]);

  useEffect(() => {
    if (hasSelectedScopeManually) return;
    if (agencyDefaultScope?.key) {
      setSelectedScopeKey(agencyDefaultScope.key);
      return;
    }

    if (!selectedScopeKey && scopeOptions[0]?.key) {
      setSelectedScopeKey(scopeOptions[0].key);
    }
  }, [agencyDefaultScope?.key, hasSelectedScopeManually, scopeOptions, selectedScopeKey]);

  const favoritesByListingId = useMemo(() => {
    const map = new Map<string, OwnerListingFavorite>();
    for (const favorite of favorites ?? []) {
      map.set(favorite.ownerListingId, favorite);
    }
    return map;
  }, [favorites]);

  const aiCallsByListingId = useMemo(() => {
    const map = new Map<string, AiOutreachCall>();
    for (const call of [...localAiCalls, ...(aiCalls ?? [])]) {
      const existing = map.get(call.ownerListingId);
      if (!existing || new Date(call.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        map.set(call.ownerListingId, call);
      }
    }
    return map;
  }, [aiCalls, localAiCalls]);

  const validFavoriteCount = useMemo(() => {
    if (typeof availableFavoriteCount === 'number') return availableFavoriteCount;
    if (!Array.isArray(favorites)) return 0;
    return favorites.filter((favorite) => favorite.isFavoriteActive !== false).length;
  }, [availableFavoriteCount, favorites]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);


  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

    if (aiStatusFilter !== 'all') {
      result = result.filter((listing) => {
        const latestCall = aiCallsByListingId.get(listing.id);
        const outcome = latestCall?.outcome || 'uncalled';
        return outcome === aiStatusFilter;
      });
    }

    result.sort((left, right) => {
      const leftPostedAt = left.postedAt || 0;
      const rightPostedAt = right.postedAt || 0;
      if (rightPostedAt !== leftPostedAt) {
        return rightPostedAt - leftPostedAt;
      }

      return (right.firstDiscoveredAt || 0) - (left.firstDiscoveredAt || 0);
    });

    return result;
  }, [aiCallsByListingId, aiStatusFilter, listings]);

  useEffect(() => {
    setCurrentPage(1);
  }, [aiStatusFilter, appliedSearchQuery, constructionYearFilter, currentScope?.key, priceMax, priceMin, propertyTypeFilter, roomsFilter, sourceFilter, transactionTypeFilter]);

  const hasServerRefinementFilters =
    Boolean(appliedSearchQuery.trim()) ||
    roomsFilter !== 'all' ||
    propertyTypeFilter !== 'all' ||
    transactionTypeFilter !== 'all' ||
    constructionYearFilter !== 'all' ||
    Boolean(priceMin || priceMax);
  const totalPages =
    aiStatusFilter === 'all' && typeof totalMatchingCount === 'number'
      ? Math.max(1, Math.ceil(totalMatchingCount / LISTINGS_PER_PAGE))
      : null;
  const displayedListingCount =
    hasServerRefinementFilters && aiStatusFilter === 'all'
      ? totalMatchingCount
      : totalListingCount;
  const safeCurrentPage = currentPage;
  const paginatedListings = filteredListings;

  useEffect(() => {
    if (previousPageRef.current === safeCurrentPage) return;
    previousPageRef.current = safeCurrentPage;

    window.requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [safeCurrentPage]);

  const resetFilters = () => {
    setSearchQuery('');
    setRoomsFilter('all');
    setPropertyTypeFilter('all');
    setTransactionTypeFilter('all');
    setConstructionYearFilter('all');
    setPriceMin('');
    setPriceMax('');
    setSourceFilter(null);
    setAiStatusFilter('all');
  };

  const handleScopeChange = (value: string) => {
    setSelectedScopeKey(value);
    setHasSelectedScopeManually(true);
  };

  const handleNextPage = () => {
    if (!hasMoreListings || !nextCursor) return;
    setCursorHistory((history) => [...history, pageCursor]);
    setPageCursor(nextCursor);
    setCurrentPage((page) => page + 1);
  };

  const handlePreviousPage = () => {
    if (safeCurrentPage <= 1) return;
    setCursorHistory((history) => {
      const previousCursor = history.at(-1) ?? null;
      setPageCursor(previousCursor);
      return history.slice(0, -1);
    });
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const handleImport = async (listing: OwnerListing) => {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru import.' });
      return;
    }

    const favorite = favoritesByListingId.get(listing.id);
    const isProspecting = Boolean(favorite && favorite.isFavoriteActive !== false);
    setIsLoadingImport(listing.id);
    toast({ title: 'Import in curs...', description: 'Se preiau datele reale din anunt.' });

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: listing.source,
          url: listing.link,
          listingId: listing.id,
          ownerPhone: isProspecting ? normalizeRomanianPhone(favorite?.ownerPhone) : '',
          sourceDescription: listing.description || '',
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Importul anuntului a esuat.');
      }

      setPropertyToImport(payload.property as Partial<Property>);
      setIsImportDialogOpen(true);
      toast({ title: 'Anunt importat', description: 'Datele reale au fost pregatite pentru adaugare.' });
    } catch (error) {
      toast({
        title: 'Import esuat',
        description: error instanceof Error ? error.message : 'Nu am putut importa anuntul.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingImport(null);
    }
  };

  const handleAiBadgeClick = async (listing: OwnerListing) => {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru apelul AI.' });
      return;
    }

    const existingFavorite = favoritesByListingId.get(listing.id);
    const hasOlxSource =
      listing.source === 'olx' ||
      /^OLX$/i.test(String(listing.originSourceLabel || '').trim()) ||
      /https:\/\/(?:www\.)?olx\.ro\//i.test(String(listing.originSourceUrl || ''));
    const hasPubli24Source =
      listing.source === 'publi24' ||
      /^Publi24$/i.test(String(listing.originSourceLabel || '').trim()) ||
      /https:\/\/(?:www\.)?publi24\.ro\//i.test(String(listing.originSourceUrl || ''));
    const requiresProspecting = hasOlxSource || hasPubli24Source;
    if (requiresProspecting && (!existingFavorite || existingFavorite.isFavoriteActive === false)) {
      toast({
        title: 'Adauga anuntul in Prospectare',
        description: 'Numerele OLX si Publi24 sunt disponibile numai pentru anunturile active in Prospectare.',
      });
      return;
    }

    setIsLoadingAiDetails(listing.id);

    try {
      let localOwnerPhone = normalizeRomanianPhone(existingFavorite?.ownerPhone);
      let olxPhoneMessage = '';
      let phoneResolutionLabel = localOwnerPhone ? 'Prospectarea agentiei' : '';
      const desktopBridge = typeof window !== 'undefined' ? (window as DesktopOlxBridgeWindow).imodeusDesktop : undefined;
      const hasDesktopOlxBridge = Boolean(!localOwnerPhone && listing.source === 'olx' && desktopBridge?.getOlxPhoneNumber);

      if (hasDesktopOlxBridge && desktopBridge?.getOlxPhoneNumber) {
        const localResult = await desktopBridge.getOlxPhoneNumber({ url: listing.link });
        localOwnerPhone = normalizeRomanianPhone(localResult.phone);
        olxPhoneMessage = localResult.message || '';
        if (localOwnerPhone) {
          phoneResolutionLabel = 'sesiunea OLX locala';
        }
      }

      if (!localOwnerPhone && listing.source === 'olx') {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/owner-listings/olx-phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: listing.link, listingId: listing.id, title: listing.title }),
        });
        const payload = await response.json().catch(() => ({}));
        localOwnerPhone = normalizeRomanianPhone(payload.phone);
        olxPhoneMessage = payload.message || olxPhoneMessage;
        if (localOwnerPhone) {
          phoneResolutionLabel = 'serviciul OLX';
        }

        if (!localOwnerPhone && payload.debug) {
          console.info('OLX phone debug', payload.debug);
        }
      }

      if (localOwnerPhone) {
        const enrichedListing = {
          ...listing,
          ownerPhone: localOwnerPhone,
        };

        if (agencyId && localOwnerPhone !== normalizeRomanianPhone(existingFavorite?.ownerPhone)) {
          updateDocumentNonBlocking(doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id), {
            ownerPhone: localOwnerPhone,
            phoneExtractionStatus: 'available',
            phoneExtractionMessage: 'Numarul proprietarului a fost preluat.',
            phoneExtractionCompletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        setSelectedAiListing(enrichedListing);
        toast({
          title: 'Telefon preluat',
          description: `Numarul proprietarului a fost preluat din ${phoneResolutionLabel || 'anunt'}.`,
        });
        return;
      }

      if (requiresProspecting) {
        if (hasPubli24Source) {
          const token = await user.getIdToken(true);
          await fetch('/api/owner-listings/prospecting', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ listingId: listing.id, action: 'retry' }),
          });
        }
        toast({
          title: 'Telefon in curs de preluare',
          description:
            olxPhoneMessage ||
            'Telefonul va aparea automat in Prospectare imediat ce preluarea este finalizata.',
        });
        return;
      }

      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: listing.source,
          url: listing.link,
          listingId: listing.id,
          ownerPhone: '',
          sourceDescription: listing.description || '',
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut prelua telefonul din anunt.');
      }

      const ownerPhone =
        payload.property?.ownerPhone ||
        payload.detail?.contactPhone ||
        payload.detail?.ownerPhone ||
        '';
      const enrichedListing = {
        ...listing,
        ownerPhone,
        description: payload.property?.description || listing.description,
      };

      setSelectedAiListing(enrichedListing);

      if (ownerPhone) {
        toast({ title: 'Telefon preluat', description: 'Numarul proprietarului a fost pregatit pentru apelul AI.' });
      } else {
        toast({
          title: 'Telefon negasit',
          description:
            olxPhoneMessage ||
            'Am deschis apelul AI, dar anuntul nu a returnat un numar de telefon.',
        });
      }
    } catch (error) {
      setSelectedAiListing({ ...listing, ownerPhone: '' });
      toast({
        title: 'Preluare telefon esuata',
        description: error instanceof Error ? error.message : 'Nu am putut prelua telefonul din anunt.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAiDetails(null);
    }
  };

  const handleToggleFavorite = async (listing: OwnerListing) => {
    if (!agencyId) {
      toast({ title: 'Agentia nu este disponibila', description: 'Mai incearca dupa ce se incarca profilul agentiei.' });
      return;
    }

    const existingFavorite = favoritesByListingId.get(listing.id);
    const isActive = Boolean(existingFavorite && existingFavorite.isFavoriteActive !== false);
    if (!user) return;
    setIsUpdatingProspecting(listing.id);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/prospecting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          action: isActive ? 'remove' : 'add',
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        phoneExtractionMessage?: string;
      };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut actualiza Prospectarea.');
      toast(
        isActive
          ? {
              title: 'Scos din Prospectare',
              description: 'Istoricul si statusurile anuntului au fost pastrate.',
            }
          : {
              title: existingFavorite ? 'Readaugat in Prospectare' : 'Adaugat in Prospectare',
              description:
                payload.phoneExtractionMessage ||
                'Anuntul a fost adaugat in lista de prospectare.',
            }
      );
    } catch (error) {
      toast({
        title: 'Actualizare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut actualiza Prospectarea.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProspecting(null);
    }
  };

  const upsertFavoriteBase = (listing: OwnerListing) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id);
    const timestamp = new Date().toISOString();
    const existingFavorite = favoritesByListingId.get(listing.id);
    return { favoriteRef, timestamp, existingFavorite };
  };

  const writeFavoriteStatus = (favoriteRef: ReturnType<typeof doc>, existingFavorite: OwnerListingFavorite | undefined, data: Record<string, unknown>) => {
    if (existingFavorite) {
      updateDocumentNonBlocking(favoriteRef, data);
      return;
    }

    setDocumentNonBlocking(
      favoriteRef,
      {
        ownerListingId: String(data.ownerListingId ?? ''),
        collaborationStatus: null,
        commissionValue: '',
        propertyAddress: '',
        notes: '',
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        createdBy: data.createdBy ?? user?.uid ?? null,
        updatedAt: String(data.updatedAt ?? new Date().toISOString()),
        updatedBy: data.updatedBy ?? user?.uid ?? null,
        ...data,
      },
      {},
    );
  };

  const canCurrentAgentUpdateStatus = (favorite?: OwnerListingFavorite | null) => {
    if (!favorite) return true;

    const now = Date.now();
    const reservationExpiresAt = favorite.reservedAt ? new Date(favorite.reservedAt).getTime() + RESERVATION_TTL_MS : null;
    const reservationExpired = Boolean(
      favorite.reservedByAgentId && !favorite.takenByAgentId && !favorite.contactOutcome && reservationExpiresAt && now >= reservationExpiresAt,
    );

    if (reservationExpired) return true;
    if (favorite.takenByAgentId) return favorite.takenByAgentId === user?.uid;
    if (favorite.contactOutcomeByAgentId && favorite.contactOutcome) return favorite.contactOutcomeByAgentId === user?.uid;
    if (favorite.reservedByAgentId) return favorite.reservedByAgentId === user?.uid;
    return true;
  };

  const handleSetReserved = (listing: OwnerListing) => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
      reservedByAgentId: user?.uid ?? null,
      reservedByAgentName: currentAgentName,
      reservedAt: timestamp,
      takenByAgentId: null,
      takenByAgentName: null,
      takenAt: null,
      contactOutcome: null,
      contactOutcomeAt: null,
      contactOutcomeByAgentId: null,
      contactOutcomeByAgentName: null,
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Status actualizat', description: 'Anuntul este marcat ca rezervat.' });
  };

  const handleSetTaken = (listing: OwnerListing) => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
      reservedByAgentId: existingFavorite?.reservedByAgentId ?? user?.uid ?? null,
      reservedByAgentName: existingFavorite?.reservedByAgentName ?? currentAgentName,
      reservedAt: existingFavorite?.reservedAt ?? timestamp,
      takenByAgentId: user?.uid ?? null,
      takenByAgentName: currentAgentName,
      takenAt: timestamp,
      contactOutcome: null,
      contactOutcomeAt: null,
      contactOutcomeByAgentId: null,
      contactOutcomeByAgentName: null,
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Lead preluat', description: 'Anuntul este marcat ca preluat de agent.' });
  };

  const handleSetOutcome = (listing: OwnerListing, outcome: 'negative' | 'follow_up') => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
      reservedByAgentId: existingFavorite?.reservedByAgentId ?? user?.uid ?? null,
      reservedByAgentName: existingFavorite?.reservedByAgentName ?? currentAgentName,
      reservedAt: existingFavorite?.reservedAt ?? timestamp,
      takenByAgentId: null,
      takenByAgentName: null,
      takenAt: null,
      contactOutcome: outcome,
      contactOutcomeAt: timestamp,
      contactOutcomeByAgentId: user?.uid ?? null,
      contactOutcomeByAgentName: currentAgentName,
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({
      title: 'Status actualizat',
      description: outcome === 'negative' ? 'Anuntul a fost marcat negativ.' : 'Anuntul a fost trecut in follow-up.',
    });
  };

  const mobileFilterControls = (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="mb-2 block font-semibold">Cautare</Label>
        <Input placeholder="Cauta dupa titlu, zona, telefon sau pret" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Locatie</Label>
        <Select value={currentScope?.key || selectedScopeKey} onValueChange={handleScopeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((scope) => (
              <SelectItem key={scope.key} value={scope.key}>
                {scope.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Sursa</Label>
        <Select value={sourceFilter ?? 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? null : (value as SourceFilterValue))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate sursele</SelectItem>
            <SelectItem value="olx">OLX</SelectItem>
            <SelectItem value="imoradar24">Imoradar24</SelectItem>
            <SelectItem value="publi24">Publi24</SelectItem>
            <SelectItem value="imobiliare">Imobiliare.ro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Status AI</Label>
        <Select value={aiStatusFilter} onValueChange={(value) => setAiStatusFilter(value as AiStatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate statusurile AI</SelectItem>
            <SelectItem value="uncalled">Nesunate</SelectItem>
            <SelectItem value="queued">AI in asteptare</SelectItem>
            <SelectItem value="calling">In apel</SelectItem>
            <SelectItem value="collaborates">Colaboreaza</SelectItem>
            <SelectItem value="does_not_collaborate">Nu colaboreaza</SelectItem>
            <SelectItem value="call_later">Revino</SelectItem>
            <SelectItem value="no_answer">Nu a raspuns</SelectItem>
            <SelectItem value="invalid_number">Numar invalid</SelectItem>
            <SelectItem value="do_not_call">Nu mai suna</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Categorie</Label>
        <Select value={propertyTypeFilter} onValueChange={(value) => setPropertyTypeFilter(value as PropertyTypeFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate proprietatile</SelectItem>
            <SelectItem value="apartamente">Apartamente</SelectItem>
            <SelectItem value="case">Case</SelectItem>
            <SelectItem value="terenuri">Terenuri</SelectItem>
            <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Tranzactie</Label>
        <Select value={transactionTypeFilter} onValueChange={(value) => setTransactionTypeFilter(value as TransactionTypeFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vanzare si inchiriere</SelectItem>
            <SelectItem value="sale">Vanzare</SelectItem>
            <SelectItem value="rent">Inchiriere</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Nr. camere</Label>
        <Select value={roomsFilter} onValueChange={setRoomsFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Nr. camere</SelectItem>
            {[1, 2, 3, 4].map((room) => (
              <SelectItem key={room} value={String(room)}>
                {room} camere
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">An constructie</Label>
        <Select value={constructionYearFilter} onValueChange={setConstructionYearFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">An constructie</SelectItem>
            <SelectItem value="1977-1990">1977-1990</SelectItem>
            <SelectItem value="1990-2000">1990-2000</SelectItem>
            <SelectItem value="after-2000">Dupa 2000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Pret</Label>
        <div className="flex gap-2">
          <Input placeholder="Pret minim" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
          <Input placeholder="Pret maxim" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
        </div>
      </div>

    </div>
  );

  if (isLoading && listings.length === 0) {
    return (
      <div ref={pageTopRef} className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Anunturi de la proprietari"
        subtitle="Incarcam lista de proprietati si pregatim filtrele."
        currentScopeLabel={currentScope?.displayName}
        activeTab="listings"
        favoriteCount={validFavoriteCount}
        listingCount={null}
        adminClassic={isClassicTheme}
      />
      <OlxConnectionBanner adminClassic={isClassicTheme} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="space-y-3 p-4">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={pageTopRef} className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Anunturi de la proprietari"
        subtitle=""
        currentScopeLabel={currentScope?.displayName}
        activeTab="listings"
        favoriteCount={validFavoriteCount}
        listingCount={displayedListingCount}
        adminClassic={isClassicTheme}
      />
      <OlxConnectionBanner adminClassic={isClassicTheme} />

      <div className="sticky top-20 z-20 hidden md:block">
        <div
          className={cn(
            "rounded-[1.75rem] p-5 backdrop-blur-xl",
            isClassicTheme
              ? "border border-white/8 bg-[#152A47] text-white shadow-2xl"
              : "border border-white/50 bg-white/82 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)]",
          )}
        >
          <div className="grid grid-cols-[minmax(220px,1fr)_160px_136px_164px_148px_124px_144px_96px_96px_44px] items-center gap-2">
            <Input
              placeholder="Cauta dupa titlu, zona, telefon sau pret"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={cn(
                "h-12 min-w-0 rounded-2xl text-base",
                isClassicTheme
                  ? "border-white/20 bg-white/10 text-white placeholder:text-white/55"
                  : "border-slate-200/80 bg-white/90",
              )}
            />

            <Select value={currentScope?.key || selectedScopeKey} onValueChange={handleScopeChange}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="Locatie" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((scope) => (
                  <SelectItem key={scope.key} value={scope.key}>
                    {scope.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter ?? 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? null : (value as SourceFilterValue))}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate sursele</SelectItem>
                <SelectItem value="olx">OLX</SelectItem>
                <SelectItem value="imoradar24">Imoradar24</SelectItem>
                <SelectItem value="publi24">Publi24</SelectItem>
                <SelectItem value="imobiliare">Imobiliare.ro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={propertyTypeFilter} onValueChange={(value) => setPropertyTypeFilter(value as PropertyTypeFilter)}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate proprietatile</SelectItem>
                <SelectItem value="apartamente">Apartamente</SelectItem>
                <SelectItem value="case">Case</SelectItem>
                <SelectItem value="terenuri">Terenuri</SelectItem>
                <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
              </SelectContent>
            </Select>

            <Select value={transactionTypeFilter} onValueChange={(value) => setTransactionTypeFilter(value as TransactionTypeFilter)}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vanzare + chirie</SelectItem>
                <SelectItem value="sale">Vanzare</SelectItem>
                <SelectItem value="rent">Inchiriere</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Nr. camere</SelectItem>
                {[1, 2, 3, 4].map((room) => (
                  <SelectItem key={room} value={String(room)}>
                    {room} camere
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={constructionYearFilter} onValueChange={setConstructionYearFilter}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="An constructie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">An constructie</SelectItem>
                <SelectItem value="1977-1990">1977-1990</SelectItem>
                <SelectItem value="1990-2000">1990-2000</SelectItem>
                <SelectItem value="after-2000">Dupa 2000</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Min"
              type="number"
              value={priceMin}
              onChange={(event) => setPriceMin(event.target.value)}
              className={cn("h-12 min-w-0 rounded-2xl", isClassicTheme ? "border-white/20 bg-white/10 text-white placeholder:text-white/55" : "border-slate-200/80 bg-white/90")}
            />
            <Input
              placeholder="Max"
              type="number"
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value)}
              className={cn("h-12 min-w-0 rounded-2xl", isClassicTheme ? "border-white/20 bg-white/10 text-white placeholder:text-white/55" : "border-slate-200/80 bg-white/90")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={resetFilters}
              aria-label="Reseteaza filtrele"
              className={cn(
                "h-12 w-11 rounded-2xl",
                isClassicTheme
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  : "border-slate-200/80 bg-white/90 text-slate-700 hover:bg-white",
              )}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex max-w-xs items-center gap-2">
            <Select value={aiStatusFilter} onValueChange={(value) => setAiStatusFilter(value as AiStatusFilter)}>
              <SelectTrigger className={cn("h-11 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="Status AI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile AI</SelectItem>
                <SelectItem value="uncalled">Nesunate</SelectItem>
                <SelectItem value="queued">AI in asteptare</SelectItem>
                <SelectItem value="calling">In apel</SelectItem>
                <SelectItem value="collaborates">Colaboreaza</SelectItem>
                <SelectItem value="does_not_collaborate">Nu colaboreaza</SelectItem>
                <SelectItem value="call_later">Revino</SelectItem>
                <SelectItem value="no_answer">Nu a raspuns</SelectItem>
                <SelectItem value="invalid_number">Numar invalid</SelectItem>
                <SelectItem value="do_not_call">Nu mai suna</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="min-w-0 flex-1">
              <Filter className="mr-2 h-4 w-4" /> Filtreaza anunturi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-2xl p-0">
            <SheetHeader className="shrink-0 px-6 pb-4 pt-6 text-left">
              <SheetTitle>Filtre</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {mobileFilterControls}
            </div>
            <SheetFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button onClick={() => setIsSheetOpen(false)} className="w-full">
                Vezi {
                  aiStatusFilter === 'all' && typeof totalMatchingCount === 'number'
                    ? new Intl.NumberFormat('ro-RO').format(totalMatchingCount)
                    : filteredListings.length
                } anunturi
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Button type="button" variant="outline" size="icon" onClick={resetFilters} aria-label="Reseteaza filtrele" className="shrink-0">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {appliedSearchQuery.trim() ? (
        <div
          aria-live="polite"
          className={cn(
            'flex min-h-6 items-center text-sm font-medium',
            isClassicTheme ? 'text-white/72' : 'text-slate-600',
          )}
        >
          {isLoading
            ? 'Cautam in toate anunturile disponibile...'
            : aiStatusFilter === 'all' && typeof totalMatchingCount === 'number'
              ? `${new Intl.NumberFormat('ro-RO').format(totalMatchingCount)} anunturi potrivite`
              : `${filteredListings.length} anunturi potrivite in pagina curenta`}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredListings.length > 0 ? (
          paginatedListings.map((listing, index) => {
            const favorite = favoritesByListingId.get(listing.id);
            const isProspecting = favorite?.isFavoriteActive !== false && Boolean(favorite);
            const prospectingPhone = isProspecting
              ? normalizeRomanianPhone(favorite?.ownerPhone)
              : '';
            const latestAiCall = aiCallsByListingId.get(listing.id);
            const listingWithAi = latestAiCall
              ? {
                  ...listing,
                  ownerPhone: prospectingPhone,
                  latestAiCallId: latestAiCall.id,
                  aiOutreachStatus: latestAiCall.status,
                  aiOutreachOutcome: latestAiCall.outcome,
                  aiOutreachUpdatedAt: latestAiCall.updatedAt,
                  aiDoNotCall: latestAiCall.result?.doNotCall,
                }
              : {
                  ...listing,
                  ownerPhone: prospectingPhone,
                  latestAiCallId: undefined,
                  aiOutreachStatus: undefined,
                  aiOutreachOutcome: undefined,
                  aiOutreachUpdatedAt: undefined,
                  aiDoNotCall: undefined,
                };
            return (
              <OwnerListingCard
                key={listing.id || index}
                listing={listingWithAi}
                adminClassic={isClassicTheme}
                favoriteMeta={favorite ?? null}
                currentAgentId={user?.uid ?? null}
                currentTimestamp={currentTimestamp}
                onImport={handleImport}
                onToggleFavorite={handleToggleFavorite}
                onSetReserved={isProspecting ? handleSetReserved : undefined}
                onSetTaken={isProspecting ? handleSetTaken : undefined}
                onSetOutcome={isProspecting ? handleSetOutcome : undefined}
                isFavorite={isProspecting}
                collaborationStatus={favorite?.collaborationStatus ?? null}
                collaborationMode={favorite?.collaborationStatus ? 'readonly' : 'hidden'}
                isLoadingImport={isLoadingImport === listing.id}
                isLoadingAiDetails={
                  isLoadingAiDetails === listing.id || isUpdatingProspecting === listing.id
                }
                onAiBadgeClick={handleAiBadgeClick}
              />
            );
          })
        ) : (
          <div className="col-span-full py-10 text-center">
            <p className="text-muted-foreground">{listingsError || 'Niciun anunt gasit.'}</p>
          </div>
        )}
      </div>

      {filteredListings.length > 0 && (safeCurrentPage > 1 || hasMoreListings) ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={handlePreviousPage} disabled={safeCurrentPage === 1}>
            Anterioara
          </Button>
          <span className="text-sm text-white/75">
            Pagina {safeCurrentPage}{totalPages ? ` din ${totalPages}` : ''}
          </span>
          <Button variant="outline" onClick={handleNextPage} disabled={!hasMoreListings || !nextCursor}>
            Urmatoare
          </Button>
        </div>
      ) : null}

      <AddPropertyDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} property={propertyToImport as Property | null} />
      <AiOutreachCallModal
        open={Boolean(selectedAiListing)}
        onOpenChange={(open) => !open && setSelectedAiListing(null)}
        listing={selectedAiListing}
        latestCall={selectedAiListing ? aiCallsByListingId.get(selectedAiListing.id) ?? null : null}
        onCallCreated={(call) => setLocalAiCalls((current) => [call, ...current.filter((item) => item.id !== call.id)])}
      />
    </div>
  );
}
