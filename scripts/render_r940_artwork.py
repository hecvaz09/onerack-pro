"""Exact R940 chassis reference; no bitmap or other-model drawing reused.

Dell R940 Technical Guide figs. 1/2, pp. 11/12:
https://i.dell.com/sites/doccontent/shared-content/data-sheets/en/Documents/PowerEdge-R940-Technical-Guide.pdf
Selected Broadcom 57414 rNDC face: NetXtreme-E User Guide fig. 15, p. 22.
The 24 front bays and blank PCIe positions show capacity, not installed parts.
Shared overlay coordinates: lib/dell-r940-layout.ts (800 x 224).
"""
from pathlib import Path
from html import escape
import math

OUT=Path(__file__).resolve().parents[1]/'public/equipment-artwork'
DEFS='''<defs>
<linearGradient id="steel" x2="0" y2="1"><stop stop-color="#b8c1c6"/><stop offset=".43" stop-color="#819097"/><stop offset="1" stop-color="#56656d"/></linearGradient>
<linearGradient id="dark" x2="0" y2="1"><stop stop-color="#38464f"/><stop offset=".5" stop-color="#1b272d"/><stop offset="1" stop-color="#303d44"/></linearGradient>
<pattern id="mesh" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#131e24"/><rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="#060e13" stroke="#52616a" stroke-width=".45"/></pattern>
</defs>'''

def rect(x,y,w,h,fill,stroke='#65757e',r=1,extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" {extra}/>'
def text(x,y,s,size=8,fill='#e4edf2',anchor='start'):
    return f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" font-weight="600" fill="{fill}" text-anchor="{anchor}">{escape(str(s))}</text>'
def screw(x,y):
    return f'<circle cx="{x}" cy="{y}" r="3" fill="#c0cad0" stroke="#46565f"/><path d="M{x-2} {y}h4" stroke="#52616a"/>'
def fan(cx,cy,r):
    s=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#0d171d" stroke="#a4b0b6" stroke-width="2"/>'
    for a in range(0,360,30):
        rad=math.radians(a)
        s+=f'<path d="M{cx+7*math.cos(rad):.1f} {cy+7*math.sin(rad):.1f}L{cx+(r-3)*math.cos(rad+.35):.1f} {cy+(r-3)*math.sin(rad+.35):.1f}" stroke="#6c7a82" stroke-width="2"/>'
    for rr in [r-5,r-10]:s+=f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="none" stroke="#6c7a82"/>'
    return s+f'<circle cx="{cx}" cy="{cy}" r="8" fill="#394c56"/>'
def inlet(x,y,n):
    s=rect(x-4,y-4,46,56,'#9ba8af')+rect(x,y,38,48,'#101c23','#d9e0e4',3, f'data-psu-inlet="{n}"')
    for dx,dy in [(10,18),(25,18),(18,31)]:s+=rect(x+dx,y+dy,3,9,'#b2bfc6','#77858d',0)
    return s
def rj45(x,y):
    return rect(x,y,24,21,'#b9c5cb')+rect(x+3,y+3,18,13,'#0b1820')+rect(x+8,y+16,8,3,'#111e25')+''.join(rect(x+5+i*2,y+4,1,4,'#b9a86a','none',0) for i in range(8))
def sfp(x,y,n):
    return rect(x-2,y-2,30,35,'#bac4ca')+rect(x,y,26,31,'#0d1b22','#e0e9ee',1,f'data-rndc-port="{n}"')+rect(x+4,y+3,18,3,'#9c8a5b','none')+rect(x+4,y+24,18,3,'#455963','none')
def base(face):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="224" viewBox="0 0 800 224" role="img" aria-label="Dell PowerEdge R940 {face} planning reference"><title>Dell PowerEdge R940 — {face}</title><desc>3U reference chassis; two 2400 W AC PSU planning modules and Broadcom 57414 dual SFP28 rNDC. Bay and slot outlines indicate chassis capacity. No live power or link status.</desc>'+DEFS+rect(1,1,798,222,'url(#dark)','#9aabb5',3)+rect(9,8,782,208,'url(#steel)','#34434b',2)

def front():
    s=base('front')+rect(15,12,770,200,'#202c33')
    s+=rect(48,16,704,52,'url(#mesh)')
    s+=rect(48,70,704,13,'#74828a')
    for i in range(24):
        x=49+i*29.25
        s+=text(x+13,80,i,8,'#10202a','middle')
        s+=rect(x,86,27,120,'url(#dark)','#79868d')
        s+=rect(x+3,91,21,27,'#111c22')+rect(x+8,96,11,13,'#373e3b','#a79778',3)
        s+=rect(x+4,122,19,73,'url(#mesh)')+rect(x+3,198,21,5,'#8b9aa2')
        s+=rect(x+4,92,4,3,'#6a7c75','none')
    s+=rect(17,17,25,177,'#15232c')+text(30,33,'ID',8,anchor='middle')+rect(25,39,9,22,'#44788f')
    s+=text(30,77,'QS',7,anchor='middle')+rect(25,83,9,9,'#4b5d67')
    s+=rect(758,16,24,181,'#15232c')
    s+='<circle cx="770" cy="28" r="6" fill="#3a4f56" stroke="#a8b7bf"/>'+text(770,31,'I',7,anchor='middle')
    s+=rect(765,48,11,25,'#143a55','#a7b6bf',3)+text(770,83,'VGA',6,anchor='middle')
    s+=rect(765,111,10,24,'#141e24','#a7b6bf')+rect(768,113,3,20,'#517a94','none')
    s+=rect(765,146,10,15,'#141e24','#a7b6bf')+text(770,175,'USB',6,anchor='middle')
    s+=text(21,220,'DELL',8)+text(779,220,'POWEREDGE R940',8,anchor='end')
    return s+'</svg>\n'

def rear():
    s=base('rear')
    # 3 horizontal blanks on each side, 7 central vertical positions.
    for x,nums in [(40,[11,12,13]),(586,[8,9,10])]:
        s+=rect(x-9,20,183,111,'url(#steel)')
        for i,n in enumerate(nums):
            y=25+i*34
            s+=rect(x,y,165,24,'#9ba8ae')+rect(x+11,y+4,142,16,'url(#mesh)')+text(x-3,y+15,n,7,'#1d303c','end')
    for i,x in enumerate([254,291,328,365,402,439,523]):
        s+=rect(x,22,30,181,'url(#steel)')+rect(x+7,35,16,150,'url(#mesh)')+text(x+15,211,i+1,7,'#162b37','middle')
    # Selected rNDC replaces the reference four-RJ45 NDC in its own bay.
    s+=rect(476,22,37,181,'url(#steel)')+sfp(481,44,1)+sfp(481,96,2)
    s+=text(494,38,'1',8,'#162b37','middle')+text(494,90,'2',8,'#162b37','middle')
    s+=text(494,143,'25G',7,'#162b37','middle')+text(494,195,'rNDC',7,'#162b37','middle')
    for y in [154,170]:
        s+=f'<circle cx="487" cy="{y}" r="2" fill="#465852"/><circle cx="501" cy="{y}" r="2" fill="#465852"/>'
    for x,n in [(18,1),(638,2)]:
        s+=rect(x,139,153,73,'url(#steel)','#283b48',2)
        s+=inlet(x+12,153,n)+rect(x+1,160,7,28,'#927349','#564d40')
        s+=rect(x+53,148,10,56,'#8d9c9b','#627577',3)+fan(x+112,175,29)
        s+=text(x+112,178,'2400W',7,anchor='middle')+text(x+28,210,f'PSU {n}',8,'#162c39')
        for dx,dy in [(78,144),(146,144),(78,205),(146,205)]:s+=screw(x+dx,dy)
    s+=text(220,145,'iDRAC',8,'#132b39','middle')+rj45(208,151)
    s+=rect(210,178,23,8,'#111e27','#b9c7cf')+rect(210,191,23,8,'#111e27','#b9c7cf')+text(221,210,'USB',7,'#162b37','middle')
    s+=rect(565,149,58,19,'#16606a','#d3e2e9',5)+text(594,161,'SERIAL',7,anchor='middle')
    s+=rect(568,182,54,21,'#173e65','#d3e2e9',5)+text(595,196,'VGA',8,anchor='middle')
    s+=rect(181,151,12,10,'#162831')+'<circle cx="189" cy="179" r="5" fill="#7d8e96" stroke="#304652"/>'+text(189,194,'ID',6,'#172b38','middle')
    for x in [23,238,565,777]:s+=screw(x,126)
    s+=text(400,220,'DELL POWEREDGE R940',8,'#e7eff3','middle')
    return s+'</svg>\n'

if __name__=='__main__':
    for face,render in [('front',front),('rear',rear)]:
        (OUT/f'dell-r940-{face}.svg').write_text(render(),encoding='utf-8')
    print('Rendered R940 front and rear SVG references.')
