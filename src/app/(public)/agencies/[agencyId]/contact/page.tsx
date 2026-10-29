'use client';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { ContactLeadForm } from '@/components/public/ContactLeadForm';
import styles from '@/components/public/AgencyContact.module.css';

export default function AgencyContactPage() {
  const { agencyId, isAgencyLoading } = usePublicAgency();
  return <div className={styles.page}>
    {isAgencyLoading || !agencyId ? <p className={styles.loading} role="status">Se pregătește formularul…</p> : <ContactLeadForm agencyId={agencyId} />}
  </div>;
}
