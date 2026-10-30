import type {ReactNode} from 'react';
import {artworkUrl,type CatalogProfile} from '@/lib/catalog-artwork';

// Rotate the physical face, not its catalog heading/footer. Uniform scaling
// keeps sockets round/square at every rack zoom and pocket width.
export function PocketFace({profile,face,children,stretch=false}:{stretch?:boolean;children?:ReactNode;profile:CatalogProfile;face:'front'|'rear'}){
 return <svg className="pocket-face-art" viewBox="0 0 60 744" preserveAspectRatio={stretch?"none":"xMidYMid meet"} role="img" aria-label={`${profile.label} ${face} vertical face`}>
  <g transform="translate(-28 772) rotate(-90)">
   <image style={{clipPath:"inset(25% 3.5% 21.428571%)"}} href={artworkUrl(profile,face)} width="800" height="112" preserveAspectRatio="xMidYMid meet"/>
   {children}
  </g>
 </svg>;
}
