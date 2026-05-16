export type AiOutreachStatus =
  | 'uncalled'
  | 'queued'
  | 'scheduled'
  | 'calling'
  | 'completed'
  | 'failed'
  | 'canceled';

export type AiOutreachOutcome =
  | 'uncalled'
  | 'queued'
  | 'calling'
  | 'collaborates'
  | 'does_not_collaborate'
  | 'call_later'
  | 'no_answer'
  | 'busy'
  | 'wrong_number'
  | 'invalid_number'
  | 'already_sold'
  | 'already_has_agency'
  | 'do_not_call'
  | 'verbal_agreement'
  | 'negotiation_success'
  | 'negotiation_blocked'
  | 'needs_human_review'
  | 'failed';

export type AiCommissionType = 'percent' | 'fixed' | 'mixed';

export type AiOutreachSettings = {
  id?: string;
  agencyId: string;
  enabled: boolean;
  desiredCommissionValue: string;
  minimumCommissionValue: string;
  commissionType: AiCommissionType;
  allowNegotiation: boolean;
  allowVerbalAgreement: boolean;
  allowExactAddressCollection: boolean;
  defaultTemplateId: string;
  callWindowStart: string;
  callWindowEnd: string;
  timezone: string;
  maxDailyCalls: number;
  monthlyBudgetCap?: number | null;
  recordCalls: boolean;
  discloseAi: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AiOutreachCallResult = {
  collaborationStatus?: 'yes' | 'no' | 'maybe' | 'call_later' | 'unknown';
  propertyAvailable?: 'yes' | 'no' | 'unknown';
  exactAddressConfirmed?: boolean;
  exactAddress?: string;
  viewingAvailability?: string;
  desiredCommission?: string;
  minimumCommission?: string;
  ownerAcceptedCommission?: boolean;
  acceptedCommissionValue?: string;
  acceptedCommissionType?: AiCommissionType;
  wantsHumanCallback?: boolean;
  doNotCall?: boolean;
  alreadyHasAgency?: boolean;
  alreadySold?: boolean;
  priceMinimum?: string;
  documentsAvailable?: string;
  exclusivityInterest?: string;
  confidence?: number;
  missingFields?: string[];
};

export type AiOutreachCall = {
  id: string;
  agencyId: string;
  agentId?: string | null;
  agentName?: string | null;
  ownerListingId: string;
  ownerListingTitle?: string;
  ownerListingLocation?: string;
  ownerListingPrice?: string;
  ownerPhone: string;
  callerNumber?: string | null;
  phoneNumberId?: string | null;
  vapiCallId?: string | null;
  status: AiOutreachStatus;
  outcome: AiOutreachOutcome;
  attemptNumber: number;
  templateId: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cost?: number | null;
  summary?: string;
  transcript?: string;
  recordingUrl?: string | null;
  endedReason?: string | null;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
  result?: AiOutreachCallResult;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiOwnerListingSnapshot = {
  id: string;
  title: string;
  price?: string;
  location?: string;
  link?: string;
  ownerPhone?: string;
  description?: string;
};
