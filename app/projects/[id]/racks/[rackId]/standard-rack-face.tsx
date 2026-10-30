import type {ReactNode} from "react";
import {artworkUrl,type CatalogProfile} from "@/lib/catalog-artwork";
import {standardFaceGeometry,faceViewport} from "@/lib/rack-face-geometry";
export function StandardRackFace({profile,face,children}:{profile:CatalogProfile;face:"front"|"rear";children?:ReactNode}){
 const bounds=standardFaceGeometry(profile.key,face,1);
 if(!bounds)return null;
 // Image and connector hit areas share the exact same source-coordinate
 // viewport and uniform transform. Never independently stretch the overlay.
 return <svg className="catalog-face-connections standard-hardware-face" viewBox={faceViewport(bounds)} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`${profile.label} ${face} rack face`}><image aria-hidden="true" href={artworkUrl(profile,face)} x="0" y="0" width="800" height="112" preserveAspectRatio="xMidYMid meet"/>{children}</svg>;
}
