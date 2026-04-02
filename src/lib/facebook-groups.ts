import type { Agency, FacebookGroup } from '@/lib/types';

export const defaultFacebookGroups: FacebookGroup[] = [
  "https://www.facebook.com/groups/proprietardirect/",
  "https://www.facebook.com/groups/direct.proprietar.bucuresti",
  "https://www.facebook.com/groups/1641351206103083/",
  "https://www.facebook.com/groups/258889259180994/",
  "https://www.facebook.com/groups/1730657617186760/",
  "https://www.facebook.com/groups/713711863981114/",
  "https://www.facebook.com/groups/118204592204043/",
  "https://www.facebook.com/groups/358979851113612/",
  "https://www.facebook.com/groups/3188029944804073/",
  "https://www.facebook.com/groups/5730550950403049/",
  "https://www.facebook.com/groups/269598638382777/",
  "https://www.facebook.com/groups/imobiliare.particulari/",
].map((url, index) => ({
  name: `Grup Facebook ${index + 1}`,
  url,
}));

export function getAgencyFacebookGroups(agency: Agency | null): FacebookGroup[] {
  return agency?.facebookGroups?.length ? agency.facebookGroups : defaultFacebookGroups;
}
