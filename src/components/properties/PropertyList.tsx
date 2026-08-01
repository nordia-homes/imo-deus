'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FacebookCloudPublishingJob, Property } from '@/lib/types';
import { PropertyCard } from './PropertyCard';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { facebookCloudFetch } from '@/lib/facebook-cloud-client';

interface PropertyListProps {
  properties: Property[] | null;
  isLoading: boolean;
  onDeleteRequest?: (property: Property) => void;
  agencyId?: string;
  publicBasePath?: string;
  enableFacebookPublishing?: boolean;
}

const ACTIVE_JOB_STATUSES: FacebookCloudPublishingJob['status'][] = [
  'scheduled',
  'queued',
  'running',
  'cooldown',
];

export function PropertyList({
  properties,
  isLoading,
  onDeleteRequest,
  agencyId,
  publicBasePath,
  enableFacebookPublishing = false,
}: PropertyListProps) {
  const { user } = useUser();
  const [facebookJobs, setFacebookJobs] = useState<FacebookCloudPublishingJob[]>([]);

  const loadFacebookJobs = useCallback(async () => {
    if (!enableFacebookPublishing || !user) return;
    try {
      const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/jobs');
      const body = await response.json().catch(() => ({}));
      if (response.ok) setFacebookJobs(body.jobs || []);
    } catch {
      // Cardurile rămân utilizabile chiar dacă statusul runnerului nu poate fi citit temporar.
    }
  }, [enableFacebookPublishing, user]);

  useEffect(() => {
    void loadFacebookJobs();
  }, [loadFacebookJobs]);

  useEffect(() => {
    if (!enableFacebookPublishing) return;
    const hasRunningJob = facebookJobs.some((job) => ['queued', 'running', 'cooldown'].includes(job.status));
    const hasScheduledJob = facebookJobs.some((job) => job.status === 'scheduled');
    if (!hasRunningJob && !hasScheduledJob) return;
    const timer = window.setInterval(
      () => void loadFacebookJobs(),
      hasRunningJob ? 7000 : 60_000
    );
    return () => window.clearInterval(timer);
  }, [enableFacebookPublishing, facebookJobs, loadFacebookJobs]);

  const jobByProperty = useMemo(() => {
    const result = new Map<string, FacebookCloudPublishingJob>();
    for (const job of facebookJobs) {
      const current = result.get(job.propertyId);
      if (!current || (ACTIVE_JOB_STATUSES.includes(job.status) && !ACTIVE_JOB_STATUSES.includes(current.status))) {
        result.set(job.propertyId, job);
      }
    }
    return result;
  }, [facebookJobs]);

  function handleJobChange(changedJob: FacebookCloudPublishingJob) {
    setFacebookJobs((current) => {
      const exists = current.some((job) => job.id === changedJob.id);
      return exists
        ? current.map((job) => job.id === changedJob.id ? changedJob : job)
        : [changedJob, ...current];
    });
  }

  const renderPropertyList = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      );
    }

    if (!properties || properties.length === 0) {
      return (
        <Card className="agentfinder-properties-empty-card mt-4 rounded-2xl bg-transparent shadow-lg lg:bg-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nicio proprietate nu corespunde filtrelor selectate.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="agentfinder-properties-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onDeleteRequest={onDeleteRequest ? () => onDeleteRequest(property) : undefined}
            agencyId={agencyId}
            publicBasePath={publicBasePath}
            enableFacebookPublishing={enableFacebookPublishing}
            facebookJob={jobByProperty.get(property.id) || null}
            onFacebookJobChange={handleJobChange}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-4">
      {renderPropertyList()}
    </div>
  );
}
