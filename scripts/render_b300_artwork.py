"""Reproduce only the B300 reference SVGs from reviewed front/rear photographs.

No raster tracing, network access, installed-parts claims or electrical allocation.
The shared JSON positions also drive the existing saved-port overlays.
"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
LAYOUT = json.loads((ROOT / "data/catalog/b300-front-layout.json").read_text())


def rect(x, y, w, h, fill="url(#metal)", **attrs):
    extra = " ".join(f'{key.removesuffix("_").replace("_", "-")}="{value}"' for key, value in attrs.items())
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{fill}" {extra}/>'


def text(x, y, value, size=12, anchor="middle"):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Arial, sans-serif" font-size="{size}" fill="#d8e4ec">{value}</text>'


def fan(cx, cy, radius):
    s = f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="#18252d" stroke="#9babb4"/>'
    for angle in range(0, 360, 60):
        s += f'<path d="M{cx-3} {cy-3}q{-radius} {-radius/3} {-radius/2} {-radius*0.8}q{radius*0.7} {-radius/5} {radius/2+3} {radius*0.8+3}" fill="url(#metal)" stroke="#101b22" transform="rotate({angle} {cx} {cy})"/>'
    for scale in [0.35, 0.55, 0.75, 0.95]:
        s += f'<circle cx="{cx}" cy="{cy}" r="{radius*scale:.2f}" fill="none" stroke="#a4b7c3" stroke-width="1.3"/>'
    for angle in [0,45,90,135]:
        s += f'<path d="M{cx-radius} {cy}h{radius*2}" stroke="#869eae" stroke-width="1.2" transform="rotate({angle} {cx} {cy})"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{radius*0.18}" fill="#718693" stroke="#afbdc5"/>'
    return s


def shell(face):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="640" viewBox="0 0 800 640" role="img" aria-label="Supermicro AS-8126GS-NB3RT B300 {face} reference">
<title>Supermicro AS-8126GS-NB3RT - {face}</title>
<desc>Model-specific reference based on manufacturer front and rear views and user-supplied photographs. Bays describe capacity, not installed options. Paired PSU input topology is not a validated power-wiring plan.</desc>
<defs>
 <linearGradient id="metal" x1="0" y1="0" x2="0.15" y2="1"><stop stop-color="#8b9ca7" stop-opacity=".86"/><stop offset=".08" stop-color="#566b79" stop-opacity=".92"/><stop offset=".45" stop-color="#3b505e"/><stop offset="1" stop-color="#24343f"/></linearGradient>
 <linearGradient id="edge"><stop stop-color="#293c48"/><stop offset=".38" stop-color="#a9bbc4" stop-opacity=".9"/><stop offset="1" stop-color="#3d5260"/></linearGradient>
 <linearGradient id="grille" x2=".2" y2="1"><stop stop-color="#708592"/><stop offset="1" stop-color="#334a58"/></linearGradient>
 <pattern id="mesh" width="10" height="8.66" patternUnits="userSpaceOnUse"><rect width="10" height="8.66" fill="#506875"/><path d="M2.5 .3h5L9.7 4.33 7.5 8.36h-5L.3 4.33Z" fill="#0c171f" stroke="#879ca8" stroke-opacity=".22" stroke-width=".55"/></pattern>
 <pattern id="small-mesh" width="6" height="5.2" patternUnits="userSpaceOnUse"><rect width="6" height="5.2" fill="#576d7b"/><circle cx="3" cy="2.6" r="2" fill="#101c24"/></pattern>
</defs>
{rect(2,2,796,636,stroke="#aabcc6",stroke_width=2)}
'''


def network(box, endpoint, rj45=False):
    x, y, w, h = [box[k] for k in ["x", "y", "w", "h"]]
    s = f'<g data-network-endpoint="{endpoint}"><title>{endpoint}</title>'
    s += rect(x-3, y-3, w+6, h+6, "#8fa4af", stroke="#b7c5cc")
    s += rect(x, y, w, h, "#08121a", class_="port-opening", stroke="#374d5a")
    if rj45:
        s += rect(x+w*0.27, y+h-4, w*0.46, 4, "#21333e")
        for n in range(8):
            s += rect(x+3+n*(w-6)/8, y+2, 1, 4, "#b4a979")
    else:
        s += f'<path d="M{x+3} {y+h-2}h{w-6}" stroke="#c1b57d" stroke-width="1"/>'
    return s + "</g>"


def front():
    s = shell("front")
    for x in [8, 774]:
        s += rect(x, 8, 18, 624, "url(#edge)", stroke="#a3b5c0")
        for y in [38, 184, 450, 603]:
            s += f'<circle cx="{x+9}" cy="{y}" r="6" fill="#4b626f" stroke="#bfccd2"/><path d="M{x+5} {y}h8" stroke="#253945"/>'
        s += rect(x+1, 231, 16, 184, "url(#edge)", stroke="#becad0")
    s += rect(32, 14, 736, 138, "url(#mesh)", stroke="#acbec8", stroke_width=2)
    for n, box in enumerate(LAYOUT["cx8"], 1):
        s += network(box, f"CX8-{n}")
        s += text(box["x"]+box["w"]/2, 52, f"CX8-{n}", 11)
    s += rect(32, 160, 736, 288, "url(#mesh)", stroke="#a4b8c5", stroke_width=2)
    s += rect(37, 166, 726, 275, "none", stroke="#203743", stroke_width=5)
    for x in [58, 495]:
        s += rect(x, 413, 246, 19, "#182b37", stroke="#7d929f")
        s += rect(x+8, 416, 230, 5, "#7f95a2", opacity=".48")
    # Lower front: PCIe capacity, storage bays and actual I/O positions.
    s += rect(32, 456, 736, 170, "url(#metal)", stroke="#b2c3ce")
    for n, x in enumerate([42, 550], 1):
        s += f'<g data-pcie-bay="{n}">{rect(x,468,208,62,"#253e4d",stroke="#a5b8c4")}'
        for y in [475, 503]:
            s += rect(x+13, y, 180, 18, "url(#small-mesh)", stroke="#829ba9")
        for xx in [x+4, x+195]:
            s += rect(xx, 485, 8, 22, "#101d26")
        s += "</g>"
    s += rect(268, 468, 264, 148, "url(#mesh)", stroke="#b4c4ce")
    for x in [82, 105]:
        s += f'<g data-storage-kind="M.2">{rect(x,548,15,67,"#142733",stroke="#8fa6b4")}{rect(x+3,552,4,56,"#435d6c")}</g>'
    for n, x in enumerate([135, 161, 187, 213, 550, 576, 602, 628]):
        s += f'<g data-storage-bay="{n}">{rect(x,548,23,67,"#12222d",stroke="#738c9c")}{rect(x+15,552,5,49,"#3b5363")}{rect(x+4,607,15,4,"#a87a35")}</g>'
    s += rect(42, 548, 29, 67, "#425a69", stroke="#a2b7c3")
    s += '<circle cx="55" cy="559" r="4" fill="#7d929f" stroke="#c2d0d7"/>'
    s += rect(540, 510, 9, 27, "#25466b", stroke="#a5bac6")
    s += '<g data-service-port="VGA"><path d="M541 515v17m3-17v17m3-17v17" stroke="#879db6" stroke-dasharray="1 3"/></g>'
    s += rect(674, 556, 19, 8, "#162936", stroke="#b0c1cc", data_service_port="Mini-DP")
    s += rect(674, 575, 18, 9, "#14222c", stroke="#a9becb", data_service_port="USB2")
    s += rect(674, 606, 20, 8, "#264a6f", stroke="#a9becb", data_service_port="USB3")
    s += network(LAYOUT["mgmt"], "MGMT", True)
    for n, box in enumerate(LAYOUT["lan"], 1):
        s += network(box, f"LAN{n}", True)
    s += text(722, 545, "MGMT", 10)
    s += text(722, 625, "LAN1", 10)+text(756, 625, "LAN2", 10)
    s += '<path d="M3 3h794v14H3Z" fill="#e2eef4" opacity=".12"/></svg>\n'
    return s


def rear():
    s = shell("rear")
    for row in range(2):
        for col in range(5):
            x, y = 13+col*155, 12+row*153
            s += f'<g data-rear-fan="{row*5+col+1}">{rect(x,y,151,148,"url(#mesh)",stroke="#a8bcc8",stroke_width=2)}'
            s += rect(x+134, y+45, 10, 59, "#213946", stroke="#a7bbc8")+"</g>"
    # Four PSU modules over two outer modules and two dummy-fan modules.
    # Both visible AC inputs are drawn. The existing single-input power mapper
    # is not used for this paired-input topology.
    modules=[(1,13,324),(2,207,324),(3,401,324),(4,595,324),(5,13,480),(6,595,480)]
    for n,x,y in modules:
        s += f'<g data-psu-module="{n}"><title>PSU {n}; paired AC inputs, power mapping not validated</title>{rect(x,y,190,148,"#2e4553",stroke="#a6bbc7",stroke_width=2)}'
        for inlet, yy in enumerate([y+12,y+79],1):
            s += f'<g data-module-input="{n}-{inlet}">{rect(x+7,yy,29,54,"#09151e",stroke="#9bafbc")}'
            for px,py in [(8,17),(21,17),(14,33)]:
                s += rect(x+7+px, yy+py, 3, 8, "#a3b5c0")
            s += "</g>"
        s += fan(x+111,y+70,61)
        s += rect(x+177,y+53,7,64,"#8d454d",stroke="#b7a1a6")
        s += text(x+111,y+141,f"PSU {n}",11)+"</g>"
    for x in [207,401]:
        s += f'<g data-dummy-fan="true"><title>Dummy PSU fan module; no AC inlet</title>{rect(x,480,190,148,"url(#mesh)",stroke="#b2c4d0",stroke_width=2)}{rect(x+174,525,9,53,"#8198a6")}</g>'
    return s+'<path d="M3 3h794v9H3Z" fill="#e2eef4" opacity=".12"/></svg>\n'


if __name__ == "__main__":
    for face, svg in [("front",front()),("rear",rear())]:
        path=ROOT / f"public/equipment-artwork/smc-b3008u-{face}.svg"
        if "--check" in sys.argv:
            if not path.exists() or path.read_bytes()!=svg.encode():
                raise SystemExit(f"Generated artwork differs: {path.name}")
        else:
            path.write_bytes(svg.encode())
