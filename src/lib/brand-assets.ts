import imodeus from '../../public/imodeus-logo.png';
import imodeusSidebar from '../../public/imodeus-sidebar-icon.png';
import imobiliare from '../../public/imobiliare-logo.svg';
import storia from '../../public/storia-official-logo.svg';
import publi24 from '../../public/publi24-logo.svg';
import trimbitasu from '../../public/trimbitasu-logo.png';
import olx from '../../public/olx-logo.svg';

// Static imports emit versioned files under /_next/static/media and include
// them in the deployment, without relying on separately served public paths.
export const brandAssets = {
  imodeus: imodeus.src,
  imodeusSidebar: imodeusSidebar.src,
  imobiliare: imobiliare.src,
  storia: storia.src,
  publi24: publi24.src,
  trimbitasu: trimbitasu.src,
  olx: olx.src,
} as const;
